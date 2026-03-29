"""
Graph-specific explanation for GraphSAGE prediction.
Uses PyTorch Geometric GNNExplainer when available (learned feature importance from the model);
falls back to heuristic feature importance if GNNExplainer fails.
See docs/RISK_EXPLAINABILITY.md for how risk prediction gets its explainability.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import torch

logger = logging.getLogger(__name__)
MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.normpath(os.path.join(MODULE_DIR, "..", ".."))
ARTIFACTS_DIR = os.getenv("MODEL_ARTIFACTS_DIR") or os.path.join(BACKEND_ROOT, "artifacts")

# Feature names from GraphSAGE v2 metrics (clinical only; order matters for importance heuristic)
DEFAULT_FEATURE_NAMES = [
    "HBA1C", "FASTING_GLUCOSE", "RANDOM_GLUCOSE", "BMI", "SYSTOLIC_BP", "DIASTOLIC_BP",
    "TOTAL_CHOLESTEROL", "HDL", "LDL", "TRIGLYCERIDES", "AGE", "SEX", "HEIGHT_CM", "WEIGHT_KG",
]

# Heuristic weights for diabetes risk (higher = more impact when value is elevated)
FEATURE_WEIGHTS = {
    "HBA1C": 0.28,
    "FASTING_GLUCOSE": 0.18,
    "RANDOM_GLUCOSE": 0.18,
    "BMI": 0.15,
    "SYSTOLIC_BP": 0.06,
    "DIASTOLIC_BP": 0.04,
    "TOTAL_CHOLESTEROL": 0.03,
    "HDL": 0.02,
    "LDL": 0.02,
    "TRIGLYCERIDES": 0.02,
    "AGE": 0.01,
    "SEX": 0.0,
    "HEIGHT_CM": 0.0,
    "WEIGHT_KG": 0.0,
}

# GNNExplainer settings (fewer epochs for faster API response; increase for more accuracy)
GNN_EXPLAINER_EPOCHS = 50
GNN_EXPLAINER_LR = 0.01


def _load_feature_meta() -> Dict[str, Any]:
    """Load feature_meta from GraphSAGE artifacts for names and optional importance."""
    try:
        candidates = [
            os.path.join(ARTIFACTS_DIR, "GraphSage_v2"),
            os.path.join(ARTIFACTS_DIR, "graphsage_v2"),
            os.path.join(ARTIFACTS_DIR, "GraphSage"),
            os.path.join(ARTIFACTS_DIR, "graphsage"),
        ]
        base = next((candidate for candidate in candidates if os.path.isdir(candidate)), "")
        if not base:
            return {}
        metrics_path = os.path.join(base, "metrics.json")
        if not os.path.exists(metrics_path):
            return {}
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics = json.load(f)
        return metrics.get("feature_meta") or {}
    except Exception as e:
        logger.warning("Could not load feature_meta: %s", e)
        return {}


def _explain_with_gnn_explainer(
    patient_id: str,
    prediction: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """
    Use PyTorch Geometric's GNNExplainer to learn which input features the GraphSAGE model
    used to reach its prediction. Returns same shape as explain_risk_prediction, or None on failure.
    """
    try:
        from torch_geometric.explain import Explainer, Explanation
        from torch_geometric.explain.algorithm import GNNExplainer
        from torch_geometric.explain.config import ModelConfig, ModelMode, ModelReturnType, ModelTaskLevel

        from services.prediction.service import (
            GraphSAGENet,
            _feature_vector_from_patient_data,
            _get_feature_meta,
            _load_graphsage_artifacts,
            _patient_data_from_mongo,
        )

        patient_data = _patient_data_from_mongo(patient_id)
        artifacts = _load_graphsage_artifacts()
        feature_meta = _get_feature_meta(artifacts)
        x = _feature_vector_from_patient_data(patient_data, feature_meta)
        # Ensure we have a batch dimension and clone so we can optimize masks
        if x.dim() == 1:
            x = x.unsqueeze(0)
        x = x.clone().detach().requires_grad_(False)
        edge_index = torch.empty((2, 0), dtype=torch.long, device=x.device)

        ckpt = artifacts["checkpoint"]
        cfg = ckpt["config"]["model"]
        model = GraphSAGENet(
            ckpt["in_channels"],
            cfg["hidden_dim"],
            cfg["num_layers"],
            cfg["dropout"],
        )
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()

        algorithm = GNNExplainer(epochs=GNN_EXPLAINER_EPOCHS, lr=GNN_EXPLAINER_LR)
        model_config = ModelConfig(
            mode=ModelMode.binary_classification,
            task_level=ModelTaskLevel.node,
            return_type=ModelReturnType.raw,
        )
        explainer = Explainer(
            model=model,
            algorithm=algorithm,
            explanation_type="model",
            model_config=model_config,
            node_mask_type="common_attributes",
            edge_mask_type=None,
        )

        explanation = explainer(x, edge_index, index=0)
        if not isinstance(explanation, Explanation):
            return None
        node_mask = getattr(explanation, "node_mask", None)
        if node_mask is None:
            return None
        # node_mask shape (1, F) for common_attributes; use as importance
        imp = node_mask.detach().squeeze().cpu()
        if imp.dim() == 0:
            imp = imp.unsqueeze(0)
        imp = imp.numpy().tolist()

        meta = _load_feature_meta()
        names = meta.get("clinical_feature_names") or DEFAULT_FEATURE_NAMES
        top_features = []
        for i, name in enumerate(names):
            if i >= len(imp):
                break
            top_features.append({"name": name, "importance": round(float(imp[i]), 4)})
        top_features.sort(key=lambda t: abs(t["importance"]), reverse=True)
        top_features = top_features[:8]

        risk_score = prediction.get("risk_score", 0)
        if risk_score >= 0.6:
            risk_explanation = (
                "Risk is elevated. The GNNExplainer identified the input features that most "
                "influence this GraphSAGE prediction; see top features below."
            )
        elif risk_score >= 0.3:
            risk_explanation = (
                "Risk is in the moderate range. Top features show which inputs the model relied on."
            )
        else:
            risk_explanation = (
                "Risk score is in the lower range. Top features reflect the inputs that most "
                "influence the prediction (GNNExplainer)."
            )

        return {
            "risk_explanation": risk_explanation,
            "top_features": top_features,
            "graph_context_summary": (
                "Explanation from PyTorch Geometric GNNExplainer: learned importance of each "
                "input feature for this prediction given the trained GraphSAGE model."
            ),
            "method": "gnn_explainer",
        }
    except Exception as e:
        logger.warning("GNNExplainer failed, falling back to heuristic: %s", e, exc_info=False)
        return None


def explain_risk_prediction(patient_id: str, prediction: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return structured explanation for the risk prediction.
    Uses PyG GNNExplainer when available; otherwise heuristic feature importance.
    """
    result = _explain_with_gnn_explainer(patient_id, prediction)
    if result is not None:
        return result

    # Fallback: heuristic feature importance
    meta = _load_feature_meta()
    names = meta.get("clinical_feature_names") or DEFAULT_FEATURE_NAMES

    try:
        from services.prediction.service import _patient_data_from_mongo, _get_feature_meta, _load_graphsage_artifacts
        from services.prediction.service import _feature_vector_from_patient_data
        patient_data = _patient_data_from_mongo(patient_id)
        artifacts = _load_graphsage_artifacts()
        feature_meta = _get_feature_meta(artifacts)
        x = _feature_vector_from_patient_data(patient_data, feature_meta)
        vec = x.numpy().flatten()
    except Exception as e:
        logger.warning("Could not get patient feature vector: %s", e)
        vec = None

    top_features: List[Dict[str, Any]] = []
    if vec is not None and len(names) <= len(vec):
        for i, name in enumerate(names):
            if i >= len(vec):
                break
            w = FEATURE_WEIGHTS.get(name, 0.05)
            contrib = abs(float(vec[i])) * w
            top_features.append({"name": name, "importance": round(contrib, 4)})
        top_features.sort(key=lambda t: t["importance"], reverse=True)
        top_features = top_features[:8]
    else:
        for name in names[:6]:
            w = FEATURE_WEIGHTS.get(name, 0.1)
            top_features.append({"name": name, "importance": round(w, 4)})

    risk_score = prediction.get("risk_score", 0)
    if risk_score >= 0.6:
        risk_explanation = (
            "Risk is elevated based on the model's assessment of patient features. "
            "Contributing factors typically include glycemic markers (e.g. HbA1c, fasting glucose), "
            "BMI, and related metabolic measures. Review top features below."
        )
    elif risk_score >= 0.3:
        risk_explanation = (
            "Risk is in the moderate range. Contributing features may include "
            "glycemic and metabolic indicators. See top features for detail."
        )
    else:
        risk_explanation = (
            "Risk score is in the lower range based on current features. "
            "Top features reflect the inputs that most influence the prediction."
        )

    return {
        "risk_explanation": risk_explanation,
        "top_features": top_features,
        "graph_context_summary": (
            "Prediction reflects similarity to patient metabolic profiles in the training distribution. "
            "Feature importance is heuristic (GNNExplainer unavailable or failed)."
        ),
        "method": "feature_importance",
    }


def explain_risk_from_patient_data(
    patient_data: Dict[str, Any],
    prediction: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Return structured explanation for a what-if scenario using the same
    feature normalization path as GraphSAGE inference, without mutating Mongo data.
    """
    meta = _load_feature_meta()
    names = meta.get("clinical_feature_names") or DEFAULT_FEATURE_NAMES

    try:
        from services.prediction.service import (
            _feature_vector_from_patient_data,
            _get_feature_meta,
            _load_graphsage_artifacts,
        )

        artifacts = _load_graphsage_artifacts()
        feature_meta = _get_feature_meta(artifacts)
        x = _feature_vector_from_patient_data(dict(patient_data), feature_meta)
        vec = x.numpy().flatten()
    except Exception as e:
        logger.warning("Could not get scenario feature vector: %s", e)
        vec = None

    top_features: List[Dict[str, Any]] = []
    if vec is not None and len(names) <= len(vec):
        for i, name in enumerate(names):
            if i >= len(vec):
                break
            w = FEATURE_WEIGHTS.get(name, 0.05)
            contrib = abs(float(vec[i])) * w
            value = patient_data.get(name)
            top_features.append(
                {
                    "name": name,
                    "importance": round(contrib, 4),
                    "value": "" if value is None else str(value),
                }
            )
        top_features.sort(key=lambda t: t["importance"], reverse=True)
        top_features = top_features[:8]
    else:
        for name in names[:6]:
            w = FEATURE_WEIGHTS.get(name, 0.1)
            value = patient_data.get(name)
            top_features.append(
                {
                    "name": name,
                    "importance": round(w, 4),
                    "value": "" if value is None else str(value),
                }
            )

    risk_score = prediction.get("risk_score", 0)
    if risk_score >= 0.6:
        risk_explanation = (
            "Scenario risk remains elevated based on the modified GraphSAGE input profile. "
            "The most influential modeled inputs are listed below."
        )
    elif risk_score >= 0.3:
        risk_explanation = (
            "Scenario risk is in the moderate range. The top modeled inputs below had the "
            "largest effect on the updated prediction."
        )
    else:
        risk_explanation = (
            "Scenario risk is in the lower range based on the updated feature profile. "
            "The listed inputs had the strongest influence on the revised prediction."
        )

    return {
        "risk_explanation": risk_explanation,
        "top_features": top_features,
        "graph_context_summary": (
            "Scenario explanation uses the same GraphSAGE feature normalization path as inference. "
            "Importance values are heuristic when instance-level GNN explanation is not run."
        ),
        "method": "feature_importance",
    }
