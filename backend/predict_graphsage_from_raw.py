"""
Simple helper script: load the trained GraphSAGE model and predict
diabetes risk for a single patient described by raw clinical values,
WITHOUT requiring a fresh TTL rebuild.

This corresponds to scenario (B):
  - You already trained and saved artifacts under artifacts/graphsage/.
  - You have a dict of clinical inputs (HBA1C, glucose, BMI, etc.).
  - You want a probability + label from the saved model.

NOTE: This uses a "feature-only" graph with a single Patient node and
no neighbors. For production use, you likely want to build a proper
patient-centered ego-graph from the TTL; this script is for quick,
standalone experimentation.
"""

from __future__ import annotations

import json
import os
from typing import Dict, Any

import numpy as np
import torch
from torch_geometric.data import Data

from train_graphsage import GraphSAGENet, ModelConfig, TrainingConfig


ARTIFACT_DIR = os.path.join("artifacts", "graphsage")


def load_artifacts() -> Dict[str, Any]:
    config_path = os.path.join(ARTIFACT_DIR, "config.json")
    metrics_path = os.path.join(ARTIFACT_DIR, "metrics.json")
    model_path = os.path.join(ARTIFACT_DIR, "model.pt")

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model checkpoint not found at {model_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        cfg_dict = json.load(f)
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics_dict = json.load(f)

    ckpt = torch.load(model_path, map_location="cpu")

    return {
        "config_json": cfg_dict,
        "metrics_json": metrics_dict,
        "checkpoint": ckpt,
    }


def build_feature_from_raw(
    patient_data: Dict[str, Any],
    feature_meta: Dict[str, Any],
    patient_node_type: str = "Patient",
) -> torch.Tensor:
    """
    Build a single-node feature vector from raw clinical inputs
    using the stored feature metadata (means/stds).

    patient_data example:
        {
            "HBA1C": 7.2,
            "RANDOM_GLUCOSE": 180,
            "BMI": 31.5,
            "SYSTOLIC_BP": 140,
            "DIASTOLIC_BP": 85,
            "TOTAL_CHOLESTEROL": 210,
            "HDL": 45,
            "LDL": 130,
            "TRIGLYCERIDES": 180,
            "AGE": 55,
            "SEX": "Male",
            "HEIGHT_CM": 170,
            "WEIGHT_KG": 85,
        }
    """
    clinical_names = feature_meta["clinical_feature_names"]
    means = np.asarray(feature_meta["feature_means"], dtype=np.float32)
    stds = np.asarray(feature_meta["feature_stds"], dtype=np.float32)
    node_types = feature_meta["node_types"]
    type_to_index = feature_meta["type_to_index"]

    num_clinical = len(clinical_names)
    num_types = len(node_types)

    x = np.zeros((num_clinical + num_types,), dtype=np.float32)

    # Fill clinical features from raw data (fallback to mean if missing)
    for i, name in enumerate(clinical_names):
        if name == "SEX":
            raw = patient_data.get("SEX")
            if raw is None:
                # fallback: mean sex encoding learned during training
                val = means[i]
            else:
                s = str(raw).strip().lower()
                if s in {"male", "m", "1"}:
                    val = 1.0
                elif s in {"female", "f", "0"}:
                    val = 0.0
                else:
                    val = means[i]
        else:
            raw = patient_data.get(name)
            if raw is None:
                val = means[i]
            else:
                try:
                    val = float(raw)
                except Exception:
                    val = means[i]

        # Normalize using training means/stds
        denom = stds[i] if stds[i] != 0.0 else 1.0
        x[i] = (val - means[i]) / denom

    # Node-type one-hot for Patient
    if patient_node_type not in type_to_index:
        raise ValueError(
            f"Unknown node type '{patient_node_type}' in feature_meta['type_to_index']"
        )
    type_idx = type_to_index[patient_node_type]
    x[num_clinical + type_idx] = 1.0

    return torch.from_numpy(x).unsqueeze(0)  # shape [1, feature_dim]


def load_model_for_inference(ckpt: Dict[str, Any]) -> GraphSAGENet:
    in_channels = ckpt["in_channels"]
    model_cfg_dict = ckpt["config"]["model"]
    model_cfg = ModelConfig(
        hidden_dim=model_cfg_dict["hidden_dim"],
        num_layers=model_cfg_dict["num_layers"],
        dropout=model_cfg_dict["dropout"],
        lr=model_cfg_dict["lr"],
        weight_decay=model_cfg_dict["weight_decay"],
        epochs=model_cfg_dict["epochs"],
    )
    model = GraphSAGENet(in_channels, model_cfg)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    return model


def predict_from_raw(patient_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    High-level helper:
      - load artifacts
      - build single-node graph for this patient
      - run the model and return probability + label
    """
    artifacts = load_artifacts()
    metrics_json = artifacts["metrics_json"]
    ckpt = artifacts["checkpoint"]

    feature_meta = metrics_json["feature_meta"]

    x = build_feature_from_raw(patient_data, feature_meta)  # [1, F]
    edge_index = torch.empty((2, 0), dtype=torch.long)  # no neighbors
    data = Data(x=x, edge_index=edge_index)

    model = load_model_for_inference(ckpt)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    data = data.to(device)

    with torch.no_grad():
        logits = model(data.x, data.edge_index)  # shape [1]
        prob = torch.sigmoid(logits[0]).item()

    pred_label = int(prob >= 0.5)

    return {
        "probability": float(prob),
        "predicted_label": pred_label,
    }


if __name__ == "__main__":
    # Example usage with a synthetic patient.
    example_patient = {
        "HBA1C": 7.5,
        "RANDOM_GLUCOSE": 185,
        "BMI": 32.0,
        "SYSTOLIC_BP": 138,
        "DIASTOLIC_BP": 86,
        "TOTAL_CHOLESTEROL": 210,
        "HDL": 45,
        "LDL": 130,
        "TRIGLYCERIDES": 180,
        "AGE": 55,
        "SEX": "Male",
        "HEIGHT_CM": 170,
        "WEIGHT_KG": 85,
    }

    result = predict_from_raw(example_patient)
    print("Prediction for example patient:")
    print(json.dumps(result, indent=2))

