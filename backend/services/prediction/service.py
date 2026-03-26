"""
Prediction service: GraphSAGE and HGT risk prediction.
- Mongo path (faster): load patient + observations from MongoDB, build real features, run model.
- TTL path: load from TTL graph (slower for single patient). Kept for compatibility.
Uses artifacts from GraphSage_v2 / graphsage_v2 first, then GraphSage / graphsage.
Artifact discovery is resolved from the backend source tree, not the current working directory.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import Data, HeteroData
from torch_geometric.nn import SAGEConv, HGTConv


SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.normpath(os.path.join(SERVICE_DIR, "..", ".."))
ARTIFACTS_DIR = os.getenv("MODEL_ARTIFACTS_DIR") or os.path.join(BACKEND_ROOT, "artifacts")
GRAPHSAGE_DIRS = [
    os.path.join(ARTIFACTS_DIR, "GraphSage_v2"),
    os.path.join(ARTIFACTS_DIR, "graphsage_v2"),
    os.path.join(ARTIFACTS_DIR, "GraphSage"),
    os.path.join(ARTIFACTS_DIR, "graphsage"),
]
HGT_DIRS = [
    os.path.join(ARTIFACTS_DIR, "HGT_v2"),
    os.path.join(ARTIFACTS_DIR, "hgt_v2"),
    os.path.join(ARTIFACTS_DIR, "HGT"),
    os.path.join(ARTIFACTS_DIR, "hgt"),
]

from app.db import get_db, parse_patient_oid


def _find_artifact_dir(candidates: List[str]) -> str:
    for d in candidates:
        if os.path.isdir(d) and os.path.exists(os.path.join(d, "model.pt")):
            return d
    raise FileNotFoundError(f"No artifact dir found; tried: {candidates}")


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------- Model definitions (match train_graphsage_v2 / train_hgt_v2) ----------
class GraphSAGENet(nn.Module):
    def __init__(self, in_channels: int, hidden_dim: int, num_layers: int, dropout: float):
        super().__init__()
        self.convs = nn.ModuleList([SAGEConv(in_channels, hidden_dim)])
        for _ in range(num_layers - 1):
            self.convs.append(SAGEConv(hidden_dim, hidden_dim))
        self.dropout = dropout
        self.out_lin = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        h = x
        for conv in self.convs:
            h = conv(h, edge_index)
            h = F.relu(h)
            h = F.dropout(h, p=self.dropout, training=self.training)
        return self.out_lin(h).squeeze(-1)


class HGTNet(nn.Module):
    def __init__(self, in_channels: int, metadata: tuple, hidden_dim: int, num_layers: int, num_heads: int, dropout: float):
        super().__init__()
        self.metadata = metadata
        self.convs = nn.ModuleList()
        self.convs.append(HGTConv(in_channels, hidden_dim, metadata=metadata, heads=num_heads))
        for _ in range(num_layers - 1):
            self.convs.append(HGTConv(hidden_dim, hidden_dim, metadata=metadata, heads=num_heads))
        self.dropout = dropout
        self.lin_patient = nn.Linear(hidden_dim, 1)

    def forward(self, x_dict, edge_index_dict):
        h_dict = x_dict
        for conv in self.convs:
            h_dict = conv(h_dict, edge_index_dict)
            h_dict = {k: F.dropout(F.relu(v), p=self.dropout, training=self.training) for k, v in h_dict.items()}
        return self.lin_patient(h_dict["Patient"]).squeeze(-1)


# ---------- Artifact loading (v2 first) ----------
@lru_cache(maxsize=1)
def _load_graphsage_artifacts() -> Dict[str, Any]:
    base = _find_artifact_dir(GRAPHSAGE_DIRS)
    metrics = _load_json(os.path.join(base, "metrics.json"))
    config = _load_json(os.path.join(base, "config.json"))
    ckpt = torch.load(os.path.join(base, "model.pt"), map_location="cpu")
    return {"metrics": metrics, "config": config, "checkpoint": ckpt}


@lru_cache(maxsize=1)
def _load_hgt_artifacts() -> Dict[str, Any]:
    base = _find_artifact_dir(HGT_DIRS)
    metrics = _load_json(os.path.join(base, "metrics.json"))
    config = _load_json(os.path.join(base, "config.json"))
    ckpt = torch.load(os.path.join(base, "model.pt"), map_location="cpu")
    return {"metrics": metrics, "config": config, "checkpoint": ckpt}


def _get_feature_meta(artifacts: Dict[str, Any]) -> Dict[str, Any]:
    """feature_meta lives at metrics root in saved metrics.json; support nested too."""
    m = artifacts.get("metrics") or {}
    return m.get("feature_meta") or (m.get("metrics") or {}).get("feature_meta") or {}


def _get_threshold(artifacts: Dict[str, Any]) -> float:
    """Prefer threshold_metrics.best_threshold from metrics, then config.best_threshold."""
    m = artifacts.get("metrics") or {}
    thr = (m.get("threshold_metrics") or {}).get("best_threshold")
    if thr is not None:
        return float(thr)
    return float((artifacts.get("config") or {}).get("best_threshold", 0.5))


# ---------- Build patient_data dict from Mongo (for feature vector) ----------
def _patient_data_from_mongo(patient_id: str) -> Dict[str, Any]:
    db = get_db()
    oid = parse_patient_oid(patient_id)
    patient = db.patients.find_one({"_id": oid})
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")
    obs_list = list(db.observations.find({"patient_id": oid}))
    by_code: Dict[str, List[float]] = {}
    for o in obs_list:
        if o.get("value_numeric") is not None:
            by_code.setdefault(o.get("observation_code") or "", []).append(float(o["value_numeric"]))
    def mean(code: str) -> Optional[float]:
        v = by_code.get(code)
        return (sum(v) / len(v)) if v else None

    # Map to training feature names (HBA1C, FASTING_GLUCOSE, RANDOM_GLUCOSE, BMI, ...)
    data: Dict[str, Any] = {}
    for code in ["HBA1C", "FASTING_GLUCOSE", "RANDOM_GLUCOSE", "BMI", "SYSTOLIC_BP", "DIASTOLIC_BP",
                 "TOTAL_CHOLESTEROL", "HDL", "LDL", "TRIGLYCERIDES", "AGE", "SEX", "HEIGHT_CM", "WEIGHT_KG"]:
        if code == "SYSTOLIC_BP":
            data[code] = mean("SYSTOLIC_BP") or mean("BLOOD_PRESSURE_SYSTOLIC")
        elif code == "DIASTOLIC_BP":
            data[code] = mean("DIASTOLIC_BP") or mean("BLOOD_PRESSURE_DIASTOLIC")
        elif code == "AGE":
            data[code] = patient.get("age")
        elif code == "SEX":
            data[code] = patient.get("sex")
        elif code in ("HEIGHT_CM", "WEIGHT_KG"):
            data[code] = patient.get("height_cm") if code == "HEIGHT_CM" else patient.get("weight_kg")
        else:
            data[code] = mean(code)
    if data.get("BMI") is None and data.get("HEIGHT_CM") and data.get("WEIGHT_KG"):
        h, w = float(data["HEIGHT_CM"]), float(data["WEIGHT_KG"])
        data["BMI"] = w / ((h / 100) ** 2) if h > 0 else None

    # Convert all values to training units (same for GraphSAGE and HGT)
    _convert_units_to_training_standard(data)
    return data


def get_patient_actual_metrics(patient_id: str) -> Dict[str, Any]:
    """
    Return patient metrics as currently recorded in Mongo, without converting them
    into training units. This is intended for clinician-facing forms and displays.
    """
    db = get_db()
    oid = parse_patient_oid(patient_id)
    patient = db.patients.find_one({"_id": oid})
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")

    lab_tests = patient.get("lab_tests") or {}
    vital_signs = patient.get("vital_signs") or {}
    lifestyle = patient.get("lifestyle") or {}

    return {
        "HBA1C": lab_tests.get("hba1c"),
        "FASTING_GLUCOSE": lab_tests.get("fasting_glucose"),
        "RANDOM_GLUCOSE": lab_tests.get("glucose"),
        "BMI": vital_signs.get("bmi"),
        "SYSTOLIC_BP": vital_signs.get("systolic_bp"),
        "DIASTOLIC_BP": vital_signs.get("diastolic_bp"),
        "TOTAL_CHOLESTEROL": lab_tests.get("cholesterol"),
        "HDL": lab_tests.get("hdl"),
        "LDL": lab_tests.get("ldl"),
        "TRIGLYCERIDES": lab_tests.get("triglycerides"),
        "AGE": patient.get("age"),
        "SEX": patient.get("sex"),
        "HEIGHT_CM": patient.get("height_cm"),
        "WEIGHT_KG": patient.get("weight_kg"),
        "SMOKING": lifestyle.get("smoking"),
        "DRINKING": lifestyle.get("drinking"),
        "EXERCISE": lifestyle.get("exercise"),
    }


# Training units (from feature_means_train in v2 artifacts): HBA1C %, glucose mg/dL, BP mmHg,
# lipids mmol/L, BMI kg/m², AGE years, SEX 0/1, HEIGHT_CM cm, WEIGHT_KG kg.
def _convert_units_to_training_standard(data: Dict[str, Any]) -> None:
    """Convert patient_data values to the units used at training so both GraphSAGE and HGT get identical inputs."""
    # --- HBA1C: training mean ~8.45 (%). If value > 20, assume mmol/mol (IFCC) -> %: (mmol/mol * 0.0915) + 2.15
    v = data.get("HBA1C")
    if v is not None:
        try:
            f = float(v)
            if f > 20:
                data["HBA1C"] = (f * 0.0915) + 2.15
        except (TypeError, ValueError):
            pass

    # --- Glucose: training RANDOM_GLUCOSE mean ~138 (mg/dL). If value in mmol/L (typical 2–25), convert to mg/dL
    for key in ("FASTING_GLUCOSE", "RANDOM_GLUCOSE"):
        v = data.get(key)
        if v is not None:
            try:
                f = float(v)
                if 2 <= f <= 25:
                    data[key] = f * 18.0182
            except (TypeError, ValueError):
                pass

    # --- Lipids: training means total ~4.85, HDL ~1.2, LDL ~2.58, trig ~2.29 (mmol/L). Convert from mg/dL if needed.
    total = data.get("TOTAL_CHOLESTEROL")
    if total is not None:
        try:
            total_f = float(total)
            if total_f > 20:
                MGDL_TO_MMOLL_CHOL = 38.67
                MGDL_TO_MMOLL_TRIG = 88.57
                data["TOTAL_CHOLESTEROL"] = total_f / MGDL_TO_MMOLL_CHOL
                if data.get("HDL") is not None:
                    data["HDL"] = float(data["HDL"]) / MGDL_TO_MMOLL_CHOL
                if data.get("LDL") is not None:
                    data["LDL"] = float(data["LDL"]) / MGDL_TO_MMOLL_CHOL
                if data.get("TRIGLYCERIDES") is not None:
                    data["TRIGLYCERIDES"] = float(data["TRIGLYCERIDES"]) / MGDL_TO_MMOLL_TRIG
        except (TypeError, ValueError):
            pass


# ---------- Build feature vector from patient_data (train normalization) ----------
def _feature_vector_from_patient_data(patient_data: Dict[str, Any], feature_meta: Dict[str, Any]) -> torch.Tensor:
    names = feature_meta["clinical_feature_names"]
    means = np.array(feature_meta.get("feature_means_train") or feature_meta.get("feature_means", []), dtype=np.float32)
    stds = np.array(feature_meta.get("feature_stds_train") or feature_meta.get("feature_stds", []), dtype=np.float32)
    if len(stds) == 0:
        stds = np.ones_like(means)
    stds[stds == 0] = 1.0
    type_to_index = feature_meta.get("type_to_index", {})
    if not type_to_index and feature_meta.get("node_types"):
        type_to_index = {t: i for i, t in enumerate(feature_meta["node_types"])}
    num_clinical = len(names)
    num_types = len(type_to_index) or 1
    x = np.zeros((num_clinical + num_types), dtype=np.float32)
    for i, name in enumerate(names):
        if name == "SEX":
            raw = patient_data.get("SEX")
            if raw is None:
                val = means[i] if i < len(means) else 0.0
            else:
                s = str(raw).strip().lower()
                val = 1.0 if s in ("male", "m", "1") else (0.0 if s in ("female", "f", "0") else (means[i] if i < len(means) else 0.0))
        else:
            raw = patient_data.get(name)
            if raw is None:
                val = means[i] if i < len(means) else 0.0
            else:
                try:
                    val = float(raw)
                except Exception:
                    val = means[i] if i < len(means) else 0.0
            # GraphSAGE v2 artifacts currently carry placeholder normalization stats
            # for FASTING_GLUCOSE (mean=0, std=1). Feeding raw mg/dL values like 90-110
            # into that slot pushes the model far out of distribution and saturates
            # predictions near 1.0 even for low-risk profiles. Until the training
            # artifacts are regenerated with correct stats, fall back to the training
            # mean for this feature instead of injecting the raw live value.
            if (
                name == "FASTING_GLUCOSE"
                and i < len(means)
                and i < len(stds)
                and abs(float(means[i])) < 1e-6
                and abs(float(stds[i]) - 1.0) < 1e-6
            ):
                val = means[i]
        denom = stds[i] if i < len(stds) else 1.0
        x[i] = (val - (means[i] if i < len(means) else 0)) / denom
    patient_idx = type_to_index.get("Patient", 0)
    x[num_clinical + patient_idx] = 1.0
    return torch.from_numpy(x).float().unsqueeze(0)


# ---------- Mongo-based prediction (real features; faster than TTL for single patient) ----------
def predict_graphsage_by_mongo_id(patient_id: str) -> Dict[str, Any]:
    patient_data = _patient_data_from_mongo(patient_id)
    return predict_graphsage_from_patient_data(patient_data, patient_id=patient_id)


def build_graphsage_patient_data(patient_id: str) -> Dict[str, Any]:
    return dict(_patient_data_from_mongo(patient_id))


def predict_graphsage_from_patient_data(
    patient_data: Dict[str, Any],
    patient_id: Optional[str] = None,
) -> Dict[str, Any]:
    runtime = _get_graphsage_runtime()
    meta = runtime["feature_meta"]
    x = _feature_vector_from_patient_data(dict(patient_data), meta)
    edge_index = torch.empty((2, 0), dtype=torch.long)
    data = Data(x=x, edge_index=edge_index)
    with torch.no_grad():
        logits = runtime["model"](data.x, data.edge_index)
        prob = torch.sigmoid(logits[0]).item()
    threshold = runtime["threshold"]
    return {"patient_id": patient_id, "probability": float(prob), "predicted_label": int(prob >= threshold)}


@lru_cache(maxsize=1)
def _get_graphsage_runtime() -> Dict[str, Any]:
    artifacts = _load_graphsage_artifacts()
    ckpt = artifacts["checkpoint"]
    cfg = ckpt["config"]["model"]
    model = GraphSAGENet(ckpt["in_channels"], cfg["hidden_dim"], cfg["num_layers"], cfg["dropout"])
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    return {
        "model": model,
        "feature_meta": _get_feature_meta(artifacts),
        "threshold": _get_threshold(artifacts),
    }


def predict_hgt_by_mongo_id(patient_id: str) -> Dict[str, Any]:
    patient_data = _patient_data_from_mongo(patient_id)
    artifacts = _load_hgt_artifacts()
    meta = _get_feature_meta(artifacts)
    x = _feature_vector_from_patient_data(patient_data, meta)
    ckpt = artifacts["checkpoint"]
    node_types, edge_types = ckpt["metadata"]
    cfg = ckpt["config"]["model"]
    model = HGTNet(ckpt["in_channels"], (node_types, edge_types), cfg["hidden_dim"], cfg["num_layers"], cfg["num_heads"], cfg["dropout"])
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    data = HeteroData()
    fd = x.shape[1]
    data["Patient"].x = x
    for t in node_types:
        if t != "Patient":
            data[t].x = torch.zeros((0, fd), dtype=x.dtype)
    for (s, r, d) in edge_types:
        data[(s, r, d)].edge_index = torch.zeros((2, 0), dtype=torch.long)
    with torch.no_grad():
        logits = model(data.x_dict, data.edge_index_dict)
        prob = torch.sigmoid(logits[0]).item()
    threshold = _get_threshold(artifacts)
    return {"patient_id": patient_id, "probability": float(prob), "predicted_label": int(prob >= threshold)}


# ---------- TTL path (stub: zero features; use Mongo path when possible) ----------
def predict_graphsage_patient(patient_uri: str, ttl_path: str) -> Dict[str, Any]:
    artifacts = _load_graphsage_artifacts()
    meta = _get_feature_meta(artifacts)
    dim = meta.get("num_clinical_features", 14) + len(meta.get("type_to_index") or meta.get("node_types") or [])
    if "feature_dim" in meta:
        dim = meta["feature_dim"]
    x = torch.zeros((1, dim), dtype=torch.float32)
    ckpt = artifacts["checkpoint"]
    cfg = ckpt["config"]["model"]
    model = GraphSAGENet(ckpt["in_channels"], cfg["hidden_dim"], cfg["num_layers"], cfg["dropout"])
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    with torch.no_grad():
        logits = model(x, torch.empty((2, 0), dtype=torch.long))
        prob = torch.sigmoid(logits[0]).item()
    return {"patient_uri": patient_uri, "probability": float(prob), "predicted_label": int(prob >= 0.5)}


def predict_hgt_patient(patient_uri: str, ttl_path: str) -> Dict[str, Any]:
    artifacts = _load_hgt_artifacts()
    meta = _get_feature_meta(artifacts)
    dim = meta.get("num_clinical_features", 14) + len(meta.get("type_to_index") or meta.get("node_types") or [])
    if "feature_dim" in meta:
        dim = meta["feature_dim"]
    ckpt = artifacts["checkpoint"]
    node_types, edge_types = ckpt["metadata"]
    cfg = ckpt["config"]["model"]
    model = HGTNet(ckpt["in_channels"], (node_types, edge_types), cfg["hidden_dim"], cfg["num_layers"], cfg["num_heads"], cfg["dropout"])
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    data = HeteroData()
    data["Patient"].x = torch.zeros((1, dim), dtype=torch.float32)
    for t in node_types:
        if t != "Patient":
            data[t].x = torch.zeros((0, dim), dtype=torch.float32)
    for (s, r, d) in edge_types:
        data[(s, r, d)].edge_index = torch.zeros((2, 0), dtype=torch.long)
    with torch.no_grad():
        logits = model(data.x_dict, data.edge_index_dict)
        prob = torch.sigmoid(logits[0]).item()
    return {"patient_uri": patient_uri, "probability": float(prob), "predicted_label": int(prob >= 0.5)}
