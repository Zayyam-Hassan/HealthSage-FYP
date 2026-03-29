"""
GraphSAGE v2 training script over the HealthSage TTL graph.

Key improvements vs v1:
- Train-only normalization (no feature leakage from val/test).
- Class-imbalance aware loss with configurable positive weighting.
- Best-epoch checkpointing based on validation ROC-AUC.
- Threshold tuning on validation set (choose best F1).
- Rich evaluation (accuracy, precision, recall, F1, ROC-AUC, PR-AUC, specificity, sensitivity).
- Feature coverage reporting for patient clinical features.
- Confusion matrix, ROC, PR curves, and loss curves.
- Backend-friendly, single-file, rdflib + PyTorch Geometric implementation.

NOTE: This script is transductive: it predicts for existing Patient nodes in the
TTL graph. For completely new patients, you need to either rebuild the graph or
use a separate feature-from-raw pipeline (like your existing helper).
"""

from __future__ import annotations

import argparse
import json
import os
import random
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Optional, Tuple

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from rdflib import Graph, Literal, Namespace, RDF, URIRef
from rdflib.namespace import XSD
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from torch_geometric.data import Data
from torch_geometric.nn import SAGEConv


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HS = Namespace("http://healthsage.org/ontology#")


@dataclass
class SplitConfig:
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    random_seed: int = 42


@dataclass
class ModelConfig:
    hidden_dim: int = 64
    num_layers: int = 2
    dropout: float = 0.3
    lr: float = 1e-3
    weight_decay: float = 1e-4
    epochs: int = 50
    # class-imbalance handling
    pos_weight_mode: Literal["auto", "none", "manual"] = "auto"
    pos_weight_manual: float = 1.0


@dataclass
class TrainingConfig:
    ttl_path: str = os.path.join("output", "healthsage_abox.ttl")
    label_observation_code: str = "DIABETES_LABEL"
    important_obs_codes: Dict[str, str] = None  # type: ignore
    split: SplitConfig = field(default_factory=SplitConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    artifacts_dir: str = os.path.join("artifacts", "graphsage_v2")
    # threshold tuning grid
    threshold_search_min: float = 0.1
    threshold_search_max: float = 0.9
    threshold_search_step: float = 0.05
    threshold_selection_mode: Literal["best_f1", "recall_constrained"] = "recall_constrained"
    target_recall: float = 0.80


def default_important_obs_codes() -> Dict[str, str]:
    return {
        "HBA1C": "HBA1C",
        "FASTING_GLUCOSE": "FASTING_GLUCOSE",
        "RANDOM_GLUCOSE": "RANDOM_GLUCOSE",
        "BMI": "BMI",
        "SYSTOLIC_BP": "BLOOD_PRESSURE_SYSTOLIC",
        "DIASTOLIC_BP": "BLOOD_PRESSURE_DIASTOLIC",
        "TOTAL_CHOLESTEROL": "CHOLESTEROL_TOTAL",
        "HDL": "HDL",
        "LDL": "LDL",
        "TRIGLYCERIDES": "TRIGLYCERIDES",
        "AGE": "AGE",
        "SEX": "SEX",
        "HEIGHT_CM": "HEIGHT_CM",
        "WEIGHT_KG": "WEIGHT_KG",
    }


def build_default_config() -> TrainingConfig:
    cfg = TrainingConfig()
    cfg.important_obs_codes = default_important_obs_codes()
    return cfg


ALLOWED_NODE_TYPES = {
    "Patient",
    "Encounter",
    "Observation",
    "ObservationDefinition",
    "Condition",
    "MedicationKnowledge",
    "PatientMedicationEvent",
}

EXCLUDED_NODE_TYPES = {
    "RiskPrediction",
    "Explanation",
    "LifestyleSuggestion",
    "MedicationSuggestion",
    "FeatureVectorSnapshot",
    "AuditLog",
    "GuidelineChunk",
}

ALLOWED_RELATIONS = {
    "hasEncounter",
    "hasObservation",
    "hasCondition",
    "hasMedicationEvent",
    "encounterHasObservation",
    "encounterHasCondition",
    "encounterHasMedicationEvent",
    "instanceOf",
    "eventMedication",
}

EXCLUDED_RELATIONS = {
    "hasRiskPrediction",
    "hasExplanation",
    "hasLifestyleSuggestion",
    "hasMedicationSuggestion",
    "explainsRiskPrediction",
    "explainsLifestyleSuggestion",
    "explainsMedicationSuggestion",
    "usedSnapshot",
    "hasFeatureSnapshot",
    "hasAuditLog",
    "citesGuideline",
    "citesGuidelineMedication",
    "citesGuidelineExplanation",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def set_random_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _local_name(uri: URIRef) -> str:
    s = str(uri)
    if "#" in s:
        return s.split("#", 1)[1]
    return s.rsplit("/", 1)[-1]


def _safe_float_literal(g: Graph, s: URIRef, p: URIRef) -> Optional[float]:
    for _, _, v in g.triples((s, p, None)):
        try:
            return float(v.toPython())
        except Exception:
            continue
    return None


def _safe_str_literal(g: Graph, s: URIRef, p: URIRef) -> Optional[str]:
    for _, _, v in g.triples((s, p, None)):
        return str(v)
    return None


# ---------------------------------------------------------------------------
# Graph loading and filtering
# ---------------------------------------------------------------------------


def load_graph(config: TrainingConfig) -> Graph:
    print(f"[load_graph] Loading TTL graph from {config.ttl_path}")
    g = Graph()
    g.parse(config.ttl_path, format="turtle")
    print(f"[load_graph] Loaded graph with {len(g)} triples")
    return g


def filter_training_graph(
    g: Graph, config: TrainingConfig
) -> Tuple[
    Dict[URIRef, int],
    Dict[int, str],
    List[Tuple[int, int]],
    Dict[URIRef, str],
    Dict[URIRef, Dict[str, Any]],
]:
    print("[filter_training_graph] Indexing node types")

    node_type_map: Dict[URIRef, str] = {}
    for s, _, o in g.triples((None, RDF.type, None)):
        if isinstance(s, URIRef):
            node_type_map.setdefault(s, _local_name(o))

    allowed_nodes: Dict[URIRef, str] = {}
    for node, t in node_type_map.items():
        if t in EXCLUDED_NODE_TYPES:
            continue
        if t in ALLOWED_NODE_TYPES:
            allowed_nodes[node] = t

    print("[filter_training_graph] Building ObservationDefinition -> obsCode map")
    obsdef_to_code: Dict[URIRef, str] = {}
    for obsdef, _, code in g.triples((None, HS.obsCode, None)):
        if isinstance(obsdef, URIRef) and isinstance(code, Literal):
            obsdef_to_code[obsdef] = str(code)

    print("[filter_training_graph] Building Observation -> (code, valueNumeric) map")
    obs_code_map: Dict[URIRef, str] = {}
    obs_value_map: Dict[URIRef, Dict[str, Any]] = {}
    for obs, _, obsdef in g.triples((None, HS.instanceOf, None)):
        if not isinstance(obs, URIRef) or not isinstance(obsdef, URIRef):
            continue
        code = obsdef_to_code.get(obsdef)
        if code is None:
            continue
        obs_code_map[obs] = code

    for obs, _, val in g.triples((None, HS.valueNumeric, None)):
        if not isinstance(obs, URIRef):
            continue
        try:
            v = float(val.toPython())
        except Exception:
            v = None
        obs_value_map.setdefault(obs, {})["valueNumeric"] = v

    print("[filter_training_graph] Assigning node indices")
    node_index: Dict[URIRef, int] = {}
    index_to_type: Dict[int, str] = {}
    for idx, (uri, t) in enumerate(sorted(allowed_nodes.items(), key=lambda x: str(x[0]))):
        node_index[uri] = idx
        index_to_type[idx] = t

    print("[filter_training_graph] Building filtered edge list")
    edges: List[Tuple[int, int]] = []
    for s, p, o in g.triples((None, None, None)):
        if not isinstance(s, URIRef) or not isinstance(o, URIRef):
            continue
        if s not in allowed_nodes or o not in allowed_nodes:
            continue
        rel = _local_name(p)
        if rel in EXCLUDED_RELATIONS:
            continue
        if rel not in ALLOWED_RELATIONS:
            continue

        # Exclude label observations from structure to avoid leakage.
        if allowed_nodes[o] == "Observation":
            code = obs_code_map.get(o)
            if code == config.label_observation_code:
                continue

        si = node_index[s]
        oi = node_index[o]
        edges.append((si, oi))
        edges.append((oi, si))

    print(
        f"[filter_training_graph] Kept {len(node_index)} nodes, {len(edges)//2} undirected edges"
    )
    return node_index, index_to_type, edges, obs_code_map, obs_value_map


# ---------------------------------------------------------------------------
# Labels, patients, and features
# ---------------------------------------------------------------------------


def extract_patient_nodes(
    node_index: Dict[URIRef, int], index_to_type: Dict[int, str]
) -> Tuple[List[URIRef], List[int]]:
    patient_uris: List[URIRef] = []
    patient_indices: List[int] = []
    for uri, idx in node_index.items():
        if index_to_type[idx] == "Patient":
            patient_uris.append(uri)
            patient_indices.append(idx)
    print(
        f"[extract_patient_nodes] Found {len(patient_indices)} Patient nodes out of {len(node_index)} total nodes"
    )
    return patient_uris, patient_indices


def extract_labels(
    g: Graph,
    patient_uris: List[URIRef],
    obs_code_map: Dict[URIRef, str],
    obs_value_map: Dict[URIRef, Dict[str, Any]],
    config: TrainingConfig,
) -> np.ndarray:
    print(
        f"[extract_labels] Extracting labels using observation code '{config.label_observation_code}'"
    )
    labels: List[int] = []
    missing = 0

    for patient in patient_uris:
        vals: List[float] = []
        for _, _, obs in g.triples((patient, HS.hasObservation, None)):
            if not isinstance(obs, URIRef):
                continue
            code = obs_code_map.get(obs)
            if code != config.label_observation_code:
                continue
            meta = obs_value_map.get(obs, {})
            v = meta.get("valueNumeric")
            if v is None:
                continue
            vals.append(float(v))
        if not vals:
            labels.append(-1)
            missing += 1
        else:
            m = float(np.mean(vals))
            labels.append(1 if m >= 0.5 else 0)

    print(
        f"[extract_labels] Extracted labels for {len(labels)} patients "
        f"({missing} missing and will be excluded from supervised training)"
    )
    return np.asarray(labels, dtype=np.int64)


def build_raw_patient_clinical(
    g: Graph,
    patient_uris: List[URIRef],
    obs_code_map: Dict[URIRef, str],
    obs_value_map: Dict[URIRef, Dict[str, Any]],
    config: TrainingConfig,
) -> Tuple[np.ndarray, List[str]]:
    print("[build_features] Building raw clinical feature matrix for patients")
    important = config.important_obs_codes
    clinical_feature_names = [
        "HBA1C",
        "FASTING_GLUCOSE",
        "RANDOM_GLUCOSE",
        "BMI",
        "SYSTOLIC_BP",
        "DIASTOLIC_BP",
        "TOTAL_CHOLESTEROL",
        "HDL",
        "LDL",
        "TRIGLYCERIDES",
        "AGE",
        "SEX",
        "HEIGHT_CM",
        "WEIGHT_KG",
    ]
    num_clinical = len(clinical_feature_names)

    patient_obs_values: Dict[URIRef, Dict[str, List[float]]] = {p: {} for p in patient_uris}
    for patient in patient_uris:
        for _, _, obs in g.triples((patient, HS.hasObservation, None)):
            if not isinstance(obs, URIRef):
                continue
            code = obs_code_map.get(obs)
            if code is None or code == config.label_observation_code:
                continue
            meta = obs_value_map.get(obs, {})
            v = meta.get("valueNumeric")
            if v is None:
                continue
            patient_obs_values[patient].setdefault(code, []).append(float(v))

    patient_clinical = np.full(
        (len(patient_uris), num_clinical), np.nan, dtype=np.float32
    )

    for i, patient in enumerate(patient_uris):
        obs_dict = patient_obs_values.get(patient, {})

        def agg_obs(feat_name: str, default: float = np.nan) -> float:
            obs_code = important.get(feat_name)
            if obs_code is None:
                return default
            vals = obs_dict.get(obs_code, [])
            if not vals:
                return default
            return float(np.mean(vals))

        patient_clinical[i, clinical_feature_names.index("HBA1C")] = agg_obs("HBA1C")
        patient_clinical[i, clinical_feature_names.index("FASTING_GLUCOSE")] = agg_obs(
            "FASTING_GLUCOSE"
        )
        patient_clinical[i, clinical_feature_names.index("RANDOM_GLUCOSE")] = agg_obs(
            "RANDOM_GLUCOSE"
        )
        patient_clinical[i, clinical_feature_names.index("BMI")] = agg_obs("BMI")
        patient_clinical[i, clinical_feature_names.index("SYSTOLIC_BP")] = agg_obs(
            "SYSTOLIC_BP"
        )
        patient_clinical[i, clinical_feature_names.index("DIASTOLIC_BP")] = agg_obs(
            "DIASTOLIC_BP"
        )
        patient_clinical[i, clinical_feature_names.index("TOTAL_CHOLESTEROL")] = agg_obs(
            "TOTAL_CHOLESTEROL"
        )
        patient_clinical[i, clinical_feature_names.index("HDL")] = agg_obs("HDL")
        patient_clinical[i, clinical_feature_names.index("LDL")] = agg_obs("LDL")
        patient_clinical[i, clinical_feature_names.index("TRIGLYCERIDES")] = agg_obs(
            "TRIGLYCERIDES"
        )

        age = _safe_float_literal(g, patient, HS.age)
        if age is not None:
            patient_clinical[i, clinical_feature_names.index("AGE")] = age

        sex_str = _safe_str_literal(g, patient, HS.sex)
        sex_val = np.nan
        if sex_str:
            s = sex_str.strip().lower()
            if s in {"male", "m"}:
                sex_val = 1.0
            elif s in {"female", "f"}:
                sex_val = 0.0
        patient_clinical[i, clinical_feature_names.index("SEX")] = sex_val

        height_cm = _safe_float_literal(g, patient, HS.heightCm)
        if height_cm is not None:
            patient_clinical[i, clinical_feature_names.index("HEIGHT_CM")] = height_cm

        weight_kg = _safe_float_literal(g, patient, HS.weightKg)
        if weight_kg is not None:
            patient_clinical[i, clinical_feature_names.index("WEIGHT_KG")] = weight_kg

    return patient_clinical, clinical_feature_names


def split_patients(
    patient_indices: List[int], labels: np.ndarray, config: TrainingConfig
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    print("[split_patients] Creating patient‑level train/val/test splits")
    labeled_mask = labels != -1
    labeled_local_idx = np.arange(len(patient_indices))[labeled_mask]
    labeled_labels = labels[labeled_mask]

    train_ratio = config.split.train_ratio
    val_ratio = config.split.val_ratio
    test_ratio = config.split.test_ratio
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-6

    set_random_seed(config.split.random_seed)

    def _split(x, y, test_size, stratify):
        try:
            return train_test_split(
                x,
                y,
                test_size=test_size,
                stratify=stratify,
                random_state=config.split.random_seed,
            )
        except Exception as e:
            print(f"[split_patients] Stratified split failed ({e}), falling back to non-stratified.")
            return train_test_split(
                x,
                y,
                test_size=test_size,
                stratify=None,
                random_state=config.split.random_seed,
            )

    train_val_idx, test_idx, y_train_val, y_test = _split(
        labeled_local_idx, labeled_labels, test_ratio, stratify=labeled_labels
    )

    val_fraction_of_trainval = val_ratio / (train_ratio + val_ratio)
    train_idx, val_idx, _, _ = _split(
        train_val_idx, y_train_val, val_fraction_of_trainval, stratify=y_train_val
    )

    print(
        f"[split_patients] Train={len(train_idx)}, Val={len(val_idx)}, Test={len(test_idx)} "
        f"(total labeled patients={len(labeled_local_idx)})"
    )
    return (
        np.asarray(train_idx, dtype=np.int64),
        np.asarray(val_idx, dtype=np.int64),
        np.asarray(test_idx, dtype=np.int64),
    )


def build_features(
    g: Graph,
    node_index: Dict[URIRef, int],
    index_to_type: Dict[int, str],
    patient_uris: List[URIRef],
    obs_code_map: Dict[URIRef, str],
    obs_value_map: Dict[URIRef, Dict[str, Any]],
    config: TrainingConfig,
    train_patient_local_idx: np.ndarray,
) -> Tuple[torch.Tensor, Dict[str, Any], Dict[str, Any]]:
    raw_matrix, clinical_feature_names = build_raw_patient_clinical(
        g, patient_uris, obs_code_map, obs_value_map, config
    )
    num_clinical = raw_matrix.shape[1]

    print("[build_features] Normalizing using TRAIN patients only")
    train_matrix = raw_matrix[train_patient_local_idx, :]
    train_means = np.nanmean(train_matrix, axis=0)
    train_stds = np.nanstd(train_matrix, axis=0)
    train_means = np.where(np.isnan(train_means), 0.0, train_means)
    train_stds = np.where(np.isnan(train_stds), 0.0, train_stds)
    train_stds[train_stds == 0.0] = 1.0

    inds = np.where(np.isnan(raw_matrix))
    if inds[0].size > 0:
        raw_matrix[inds] = np.take(train_means, inds[1])
    norm_matrix = (raw_matrix - train_means) / train_stds

    # Coverage report
    coverage: Dict[str, Dict[str, Any]] = {}
    n_patients = len(patient_uris)
    for j, name in enumerate(clinical_feature_names):
        non_missing = int(np.count_nonzero(~np.isnan(raw_matrix[:, j])))
        missing = n_patients - non_missing
        missing_pct = 100.0 * missing / max(n_patients, 1)
        coverage[name] = {
            "non_missing": non_missing,
            "missing": missing,
            "missing_pct": missing_pct,
        }
        if non_missing == 0:
            print(f"[build_features] WARNING: feature '{name}' has no non-missing values")
        elif missing_pct > 90.0:
            print(f"[build_features] WARNING: feature '{name}' is {missing_pct:.1f}% missing")

    node_types = sorted({t for t in index_to_type.values()})
    type_to_idx = {t: i for i, t in enumerate(node_types)}
    num_types = len(node_types)

    num_nodes = len(node_index)
    X = np.zeros((num_nodes, num_clinical + num_types), dtype=np.float32)

    patient_uri_to_local_idx: Dict[URIRef, int] = {uri: i for i, uri in enumerate(patient_uris)}
    for uri, node_idx_ in node_index.items():
        t = index_to_type[node_idx_]
        type_onehot_idx = type_to_idx[t]
        X[node_idx_, num_clinical + type_onehot_idx] = 1.0
        if t == "Patient":
            pi = patient_uri_to_local_idx[uri]
            X[node_idx_, :num_clinical] = norm_matrix[pi]

    x_tensor = torch.from_numpy(X)
    feature_meta = {
        "clinical_feature_names": clinical_feature_names,
        "num_clinical_features": int(num_clinical),
        "node_types": node_types,
        "type_to_index": type_to_idx,
        "num_node_types": int(num_types),
        "feature_means_train": train_means.tolist(),
        "feature_stds_train": train_stds.tolist(),
    }
    print(
        f"[build_features] Built feature matrix X with shape {x_tensor.shape} "
        f"({num_clinical} clinical + {num_types} type features)"
    )
    return x_tensor, feature_meta, coverage


# ---------------------------------------------------------------------------
# Model and training
# ---------------------------------------------------------------------------


class GraphSAGENet(nn.Module):
    def __init__(self, in_channels: int, config: ModelConfig):
        super().__init__()
        self.convs = nn.ModuleList()
        self.dropout = config.dropout

        hidden = config.hidden_dim
        self.convs.append(SAGEConv(in_channels, hidden))
        for _ in range(config.num_layers - 1):
            self.convs.append(SAGEConv(hidden, hidden))

        self.out_lin = nn.Linear(hidden, 1)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        h = x
        for conv in self.convs:
            h = conv(h, edge_index)
            h = F.relu(h)
            h = F.dropout(h, p=self.dropout, training=self.training)
        logits = self.out_lin(h).squeeze(-1)
        return logits


def build_model(data: Data, config: TrainingConfig) -> GraphSAGENet:
    in_channels = data.num_features
    print(
        f"[build_model] Building GraphSAGE model with in_channels={in_channels}, "
        f"hidden_dim={config.model.hidden_dim}, layers={config.model.num_layers}"
    )
    return GraphSAGENet(in_channels, config.model)


def train_model(
    model: GraphSAGENet,
    data: Data,
    labels: np.ndarray,
    patient_node_indices: List[int],
    train_idx: np.ndarray,
    val_idx: np.ndarray,
    config: TrainingConfig,
) -> Tuple[GraphSAGENet, Dict[str, List[float]], Dict[str, Any]]:
    print("[train_model] Starting GraphSAGE training")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    data = data.to(device)

    y = torch.from_numpy(labels).float().to(device)

    pos_count = float((labels == 1).sum())
    neg_count = float((labels == 0).sum())
    if config.model.pos_weight_mode == "none" or pos_count == 0:
        pos_weight = torch.tensor([1.0], device=device)
    elif config.model.pos_weight_mode == "manual":
        pos_weight = torch.tensor([config.model.pos_weight_manual], device=device)
    else:
        pos_weight = torch.tensor([neg_count / pos_count], device=device)

    print(
        f"[train_model] Using pos_weight={pos_weight.item():.3f} "
        f"(mode={config.model.pos_weight_mode}, pos={pos_count}, neg={neg_count})"
    )

    patient_node_indices_t = torch.tensor(patient_node_indices, dtype=torch.long).to(device)

    optimizer = torch.optim.Adam(
        model.parameters(), lr=config.model.lr, weight_decay=config.model.weight_decay
    )
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    train_idx_t = torch.from_numpy(train_idx).long().to(device)
    val_idx_t = torch.from_numpy(val_idx).long().to(device)

    history = {"train_loss": [], "val_loss": [], "val_auc": []}
    best_state = None
    best_val_auc = -1.0
    best_val_loss = float("inf")
    best_epoch = 0

    for epoch in range(1, config.model.epochs + 1):
        model.train()
        optimizer.zero_grad()
        logits_all = model(data.x, data.edge_index)
        patient_logits = logits_all[patient_node_indices_t]
        loss = criterion(patient_logits[train_idx_t], y[train_idx_t])
        loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            val_logits = patient_logits[val_idx_t]
            val_y = y[val_idx_t]
            val_loss = criterion(val_logits, val_y).item()
            val_probs = torch.sigmoid(val_logits).cpu().numpy()
            try:
                val_auc = roc_auc_score(val_y.cpu().numpy(), val_probs)
            except Exception:
                val_auc = float("nan")

        history["train_loss"].append(float(loss.item()))
        history["val_loss"].append(float(val_loss))
        history["val_auc"].append(float(val_auc))

        if not np.isnan(val_auc) and (
            val_auc > best_val_auc or (val_auc == best_val_auc and val_loss < best_val_loss)
        ):
            best_val_auc = val_auc
            best_val_loss = val_loss
            best_epoch = epoch
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 1 or epoch == config.model.epochs:
            print(
                f"[train_model] Epoch {epoch:03d} "
                f"train_loss={loss.item():.4f} val_loss={val_loss:.4f} val_auc={val_auc:.4f}"
            )

    if best_state is not None:
        model.load_state_dict(best_state)
        print(
            f"[train_model] Restored best model from epoch {best_epoch} "
            f"with val_auc={best_val_auc:.4f}, val_loss={best_val_loss:.4f}"
        )

    best_info = {
        "best_epoch": int(best_epoch),
        "best_val_auc": float(best_val_auc),
        "best_val_loss": float(best_val_loss),
        "pos_weight_used": float(pos_weight.item()),
    }
    return model, history, best_info


def tune_threshold(
    model: GraphSAGENet,
    data: Data,
    labels: np.ndarray,
    patient_node_indices: List[int],
    val_idx: np.ndarray,
    config: TrainingConfig,
) -> Tuple[Dict[str, Any], np.ndarray, List[Dict[str, Any]]]:
    device = next(model.parameters()).device
    data = data.to(device)
    y_val = torch.from_numpy(labels[val_idx]).float().to(device)

    with torch.no_grad():
        logits_all = model(data.x, data.edge_index)
        patient_logits = logits_all[torch.tensor(patient_node_indices, dtype=torch.long).to(device)]
        logits_val = patient_logits[torch.from_numpy(val_idx).long().to(device)]
        probs_val = torch.sigmoid(logits_val).cpu().numpy()

    y_true_np = y_val.cpu().numpy().astype(int)

    best_f1 = -1.0
    best_f1_thr = 0.5
    best_f1_metrics: Dict[str, Any] = {}

    # For recall-constrained mode
    best_rc_thr = None
    best_rc_prec = -1.0
    best_rc_f1 = -1.0
    best_rc_metrics: Dict[str, Any] = {}

    sweep: List[Dict[str, Any]] = []

    thr = config.threshold_search_min
    while thr <= config.threshold_search_max + 1e-8:
        preds = (probs_val >= thr).astype(int)
        # If all predictions are one class, F1 etc. are still well-defined with zero_division=0
        prec = precision_score(y_true_np, preds, zero_division=0)
        rec = recall_score(y_true_np, preds, zero_division=0)
        f1 = f1_score(y_true_np, preds, zero_division=0)

        sweep.append(
            {
                "threshold": float(thr),
                "precision": float(prec),
                "recall": float(rec),
                "f1": float(f1),
            }
        )

        # Track best-F1 threshold (for fallback and reporting)
        if f1 > best_f1:
            best_f1 = f1
            best_f1_thr = thr
            best_f1_metrics = {
                "val_precision": float(prec),
                "val_recall": float(rec),
                "val_f1": float(f1),
            }

        # For recall-constrained: require rec >= target_recall, then maximize precision, then F1
        if rec >= config.target_recall:
            if (
                prec > best_rc_prec
                or (prec == best_rc_prec and f1 > best_rc_f1)
                or best_rc_thr is None
            ):
                best_rc_thr = thr
                best_rc_prec = prec
                best_rc_f1 = f1
                best_rc_metrics = {
                    "val_precision": float(prec),
                    "val_recall": float(rec),
                    "val_f1": float(f1),
                }

        thr += config.threshold_search_step

    # Decide which threshold to deploy
    if config.threshold_selection_mode == "recall_constrained" and best_rc_thr is not None:
        chosen_thr = float(best_rc_thr)
        chosen_metrics = best_rc_metrics
        chosen_mode = "recall_constrained"
    else:
        # Fall back to best F1
        chosen_thr = float(best_f1_thr)
        chosen_metrics = best_f1_metrics
        chosen_mode = "best_f1" if config.threshold_selection_mode == "best_f1" else "recall_constrained_fallback_best_f1"

    chosen_metrics.update(
        {
            "best_threshold": chosen_thr,
            "selection_mode": chosen_mode,
            "target_recall": float(config.target_recall),
            "best_f1_threshold": float(best_f1_thr),
            "best_f1_val_precision": best_f1_metrics.get("val_precision", float("nan")),
            "best_f1_val_recall": best_f1_metrics.get("val_recall", float("nan")),
            "best_f1_val_f1": best_f1_metrics.get("val_f1", float("nan")),
        }
    )

    print(
        f"[threshold] mode={chosen_mode} "
        f"chosen_threshold={chosen_thr:.3f} "
        f"val_precision={chosen_metrics.get('val_precision', float('nan')):.4f} "
        f"val_recall={chosen_metrics.get('val_recall', float('nan')):.4f} "
        f"val_f1={chosen_metrics.get('val_f1', float('nan')):.4f}"
    )

    return chosen_metrics, probs_val, sweep


def evaluate_model(
    model: GraphSAGENet,
    data: Data,
    labels: np.ndarray,
    patient_node_indices: List[int],
    test_idx: np.ndarray,
    threshold: float,
    artifacts_dir: str,
) -> Tuple[Dict[str, Any], np.ndarray, np.ndarray, np.ndarray]:
    print("[evaluate_model] Evaluating on test patients")
    device = next(model.parameters()).device
    data = data.to(device)
    y_true = torch.from_numpy(labels[test_idx]).float().to(device)

    with torch.no_grad():
        logits_all = model(data.x, data.edge_index)
        patient_logits = logits_all[torch.tensor(patient_node_indices, dtype=torch.long).to(device)]
        logits = patient_logits[torch.from_numpy(test_idx).long().to(device)]
        probs = torch.sigmoid(logits).cpu().numpy()

    y_true_np = y_true.cpu().numpy().astype(int)
    preds = (probs >= threshold).astype(int)

    os.makedirs(artifacts_dir, exist_ok=True)
    np.save(os.path.join(artifacts_dir, "test_probs.npy"), probs)
    np.save(os.path.join(artifacts_dir, "test_labels.npy"), y_true_np)

    acc = accuracy_score(y_true_np, preds)
    precision = precision_score(y_true_np, preds, zero_division=0)
    recall = recall_score(y_true_np, preds, zero_division=0)
    f1 = f1_score(y_true_np, preds, zero_division=0)

    try:
        roc_auc = roc_auc_score(y_true_np, probs)
    except Exception:
        roc_auc = float("nan")
    try:
        pr_auc = average_precision_score(y_true_np, probs)
    except Exception:
        pr_auc = float("nan")

    cm = confusion_matrix(y_true_np, preds, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    specificity = tn / (tn + fp) if (tn + fp) > 0 else float("nan")
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else float("nan")

    metrics = {
        "accuracy": float(acc),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "confusion_matrix": cm.tolist(),
        "specificity": float(specificity),
        "sensitivity": float(sensitivity),
    }

    print(
        f"[evaluate_model] acc={acc:.4f} precision={precision:.4f} recall={recall:.4f} "
        f"f1={f1:.4f} roc_auc={roc_auc:.4f} pr_auc={pr_auc:.4f}"
    )
    return metrics, y_true_np, preds, probs


# ---------------------------------------------------------------------------
# Plots and artifacts
# ---------------------------------------------------------------------------


def _plot_confusion_matrix(
    y_true: np.ndarray, y_pred: np.ndarray, save_path: str
) -> None:
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    fig, ax = plt.subplots(figsize=(4, 4))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    ax.set(
        xticks=[0, 1],
        yticks=[0, 1],
        xticklabels=["Non-diabetic", "Diabetic"],
        yticklabels=["Non-diabetic", "Diabetic"],
        ylabel="True label",
        xlabel="Predicted label",
        title="Confusion matrix",
    )
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j,
                i,
                format(cm[i, j], "d"),
                ha="center",
                va="center",
                color="white" if cm[i, j] > thresh else "black",
            )
    fig.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)


def _plot_roc_curve(
    y_true: np.ndarray, y_prob: np.ndarray, save_path: str
) -> None:
    try:
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        auc = roc_auc_score(y_true, y_prob)
    except Exception:
        return
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.plot(fpr, tpr, label=f"ROC curve (AUC = {auc:.3f})")
    ax.plot([0, 1], [0, 1], "k--", label="Chance")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title("ROC curve")
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)


def _plot_pr_curve(
    y_true: np.ndarray, y_prob: np.ndarray, save_path: str
) -> None:
    try:
        precision, recall, _ = precision_recall_curve(y_true, y_prob)
        ap = average_precision_score(y_true, y_prob)
    except Exception:
        return
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.plot(recall, precision, label=f"PR curve (AP = {ap:.3f})")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall curve")
    ax.legend(loc="lower left")
    fig.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)


def _plot_loss_curves(
    history: Dict[str, List[float]], save_path: str
) -> None:
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(history["train_loss"], label="Train loss")
    ax.plot(history["val_loss"], label="Val loss")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("BCE loss")
    ax.set_title("Training / validation loss")
    ax.legend()
    fig.tight_layout()
    fig.savefig(save_path, dpi=150)
    plt.close(fig)


def save_artifacts(
    model: GraphSAGENet,
    data: Data,
    config: TrainingConfig,
    feature_meta: Dict[str, Any],
    coverage: Dict[str, Any],
    mappings: Dict[str, Any],
    metrics: Dict[str, Any],
    history: Dict[str, List[float]],
    best_info: Dict[str, Any],
    threshold_metrics: Dict[str, Any],
) -> None:
    print(f"[save_artifacts] Saving artifacts under {config.artifacts_dir}")
    os.makedirs(config.artifacts_dir, exist_ok=True)

    model_path = os.path.join(config.artifacts_dir, "model.pt")
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "in_channels": data.num_features,
            "config": {
                "split": asdict(config.split),
                "model": asdict(config.model),
                "ttl_path": config.ttl_path,
                "label_observation_code": config.label_observation_code,
            },
        },
        model_path,
    )

    config_json_path = os.path.join(config.artifacts_dir, "config.json")
    with open(config_json_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "ttl_path": config.ttl_path,
                "split": asdict(config.split),
                "model": asdict(config.model),
                "label_observation_code": config.label_observation_code,
                "important_obs_codes": config.important_obs_codes,
                "best_threshold": threshold_metrics.get("best_threshold", 0.5),
            },
            f,
            indent=2,
        )

    metrics_json_path = os.path.join(config.artifacts_dir, "metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        payload = {
            "metrics": metrics,
            "train_loss_history": history["train_loss"],
            "val_loss_history": history["val_loss"],
            "val_auc_history": history["val_auc"],
            "num_nodes": int(data.num_nodes),
            "num_edges": int(data.num_edges),
            "feature_meta": feature_meta,
            "feature_coverage": coverage,
            "best_info": best_info,
            "threshold_metrics": threshold_metrics,
        }
        json.dump(payload, f, indent=2)

    mappings_json_path = os.path.join(config.artifacts_dir, "mappings.json")
    with open(mappings_json_path, "w", encoding="utf-8") as f:
        json.dump(mappings, f, indent=2)

    print("[save_artifacts] Artifacts saved:")
    print(f"  - {model_path}")
    print(f"  - {config_json_path}")
    print(f"  - {metrics_json_path}")
    print(f"  - {mappings_json_path}")


def predict_patient(
    model: GraphSAGENet,
    data: Data,
    patient_uri: str,
    mappings: Dict[str, Any],
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Transductive prediction helper:
    - Assumes the patient URI already exists in the trained graph (same TTL).
    - For new/unseen patients you need to insert them into the graph or build
      features separately (e.g. via a raw-feature pipeline).
    """
    uri_to_index = {URIRef(k): int(v) for k, v in mappings["uri_to_index"].items()}
    patient_uri_to_patient_id = mappings.get("patient_uri_to_patient_id", {})

    uri_ref = URIRef(patient_uri)
    if uri_ref not in uri_to_index:
        raise ValueError(f"Unknown patient URI {patient_uri}")

    node_idx = uri_to_index[uri_ref]
    patient_id = patient_uri_to_patient_id.get(str(uri_ref), str(uri_ref))

    device = next(model.parameters()).device
    data = data.to(device)

    model.eval()
    with torch.no_grad():
        logits = model(data.x, data.edge_index)
        prob = torch.sigmoid(logits[node_idx]).item()

    pred_label = 1 if prob >= threshold else 0
    return {
        "patient_id": patient_id,
        "patient_uri": patient_uri,
        "probability": float(prob),
        "predicted_label": int(pred_label),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(args: Optional[List[str]] = None) -> None:
    parser = argparse.ArgumentParser(
        description="Train GraphSAGE v2 over HealthSage TTL graph (patient risk prediction)."
    )
    parser.add_argument(
        "--ttl",
        type=str,
        default=os.path.join("output", "healthsage_abox.ttl"),
        help="Path to the TTL knowledge graph.",
    )
    parser.add_argument(
        "--label_obs_code",
        type=str,
        default="DIABETES_LABEL",
        help="ObservationDefinition.obsCode used as the binary label.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Number of training epochs (overrides default).",
    )
    parsed = parser.parse_args(args=args)

    config = build_default_config()
    config.ttl_path = parsed.ttl
    config.label_observation_code = parsed.label_obs_code
    config.model.epochs = parsed.epochs

    print("=== GraphSAGE v2 Training Configuration ===")
    print(
        json.dumps(
            {
                "ttl_path": config.ttl_path,
                "split": asdict(config.split),
                "model": asdict(config.model),
                "label_observation_code": config.label_observation_code,
                "important_obs_codes": config.important_obs_codes,
            },
            indent=2,
        )
    )

    g = load_graph(config)
    node_index, index_to_type, edge_list, obs_code_map, obs_value_map = filter_training_graph(
        g, config
    )

    patient_uris, patient_node_indices = extract_patient_nodes(node_index, index_to_type)
    labels = extract_labels(g, patient_uris, obs_code_map, obs_value_map, config)

    train_idx, val_idx, test_idx = split_patients(patient_node_indices, labels, config)

    x_tensor, feature_meta, coverage = build_features(
        g,
        node_index,
        index_to_type,
        patient_uris,
        obs_code_map,
        obs_value_map,
        config,
        train_idx,
    )

    print("[main] Building PyTorch Geometric Data object")
    edge_index = torch.tensor(edge_list, dtype=torch.long).t().contiguous()
    data = Data(x=x_tensor, edge_index=edge_index)

    model = build_model(data, config)
    model, history, best_info = train_model(
        model, data, labels, patient_node_indices, train_idx, val_idx, config
    )

    threshold_metrics, val_probs, threshold_sweep = tune_threshold(
        model, data, labels, patient_node_indices, val_idx, config
    )
    best_threshold = threshold_metrics["best_threshold"]

    metrics, y_true_test, y_pred_test, y_prob_test = evaluate_model(
        model, data, labels, patient_node_indices, test_idx, best_threshold, config.artifacts_dir
    )

    label_values = labels[labels != -1]
    unique, counts = np.unique(label_values, return_counts=True)
    label_distribution = {int(k): int(v) for k, v in zip(unique, counts)}
    print(
        "[main] Labeled patient counts: "
        f"non-diabetic={label_distribution.get(0, 0)}, "
        f"diabetic={label_distribution.get(1, 0)}"
    )

    mappings = {
        "uri_to_index": {str(uri): int(idx) for uri, idx in node_index.items()},
        "index_to_type": {int(k): v for k, v in index_to_type.items()},
        "patient_uri_to_patient_id": {str(uri): str(uri) for uri in patient_uris},
        "patient_node_indices": [int(i) for i in patient_node_indices],
        "train_indices": [int(i) for i in train_idx],
        "val_indices": [int(i) for i in val_idx],
        "test_indices": [int(i) for i in test_idx],
        "label_observation_code": config.label_observation_code,
        "important_obs_codes": config.important_obs_codes,
        "num_patients": int(len(patient_node_indices)),
        "num_nodes": int(data.num_nodes),
        "num_edges": int(data.num_edges),
        "label_distribution": label_distribution,
    }

    metrics_full = dict(metrics)
    metrics_full.update(
        {
            "num_patients": int(len(patient_node_indices)),
            "num_nodes": int(data.num_nodes),
            "num_edges": int(data.num_edges),
            "label_distribution": label_distribution,
            "train_size": int(len(train_idx)),
            "val_size": int(len(val_idx)),
            "test_size": int(len(test_idx)),
        }
    )

    os.makedirs(config.artifacts_dir, exist_ok=True)
    cm_path = os.path.join(config.artifacts_dir, "confusion_matrix.png")
    roc_path = os.path.join(config.artifacts_dir, "roc_curve.png")
    pr_path = os.path.join(config.artifacts_dir, "pr_curve.png")
    loss_path = os.path.join(config.artifacts_dir, "loss_curves.png")
    _plot_confusion_matrix(y_true_test, y_pred_test, cm_path)
    _plot_roc_curve(y_true_test, y_prob_test, roc_path)
    _plot_pr_curve(y_true_test, y_prob_test, pr_path)
    _plot_loss_curves(history, loss_path)

    save_artifacts(
        model,
        data,
        config,
        feature_meta,
        coverage,
        mappings,
        metrics_full,
        history,
        best_info,
        threshold_metrics,
    )

    print(
        f"[summary] best_epoch={best_info['best_epoch']} "
        f"best_val_auc={best_info['best_val_auc']:.4f} "
        f"threshold={best_threshold:.3f} "
        f"test_precision={metrics['precision']:.4f} "
        f"test_recall={metrics['recall']:.4f} "
        f"test_f1={metrics['f1']:.4f} "
        f"test_roc_auc={metrics['roc_auc']:.4f} "
        f"test_pr_auc={metrics['pr_auc']:.4f}"
    )


if __name__ == "__main__":
    main()

