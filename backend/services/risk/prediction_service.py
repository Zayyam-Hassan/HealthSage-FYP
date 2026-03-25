"""
Risk prediction service: runs GraphSAGE only. No recommendation logic.
Used by Risk Assessment tab and by coordinator for combined flows.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from services.prediction.service import predict_graphsage_by_mongo_id

logger = logging.getLogger(__name__)


def _score_to_label(score: float) -> str:
    if score < 0.3:
        return "low"
    if score < 0.7:
        return "medium"
    return "high"


def predict_patient_risk(patient_id: str) -> Dict[str, Any]:
    """
    Load patient context, run GraphSAGE inference, return structured risk output.
    Does not mix recommendation logic.
    """
    raw = predict_graphsage_by_mongo_id(patient_id)
    prob = raw.get("probability", 0.0)
    label = raw.get("predicted_label", 0)
    risk_label = _score_to_label(prob)
    return {
        "patient_id": patient_id,
        "risk_score": prob,
        "risk_label": risk_label,
        "predicted_label": label,
        "model_name": "GraphSAGE",
        "predicted_at": datetime.now(timezone.utc).isoformat(),
        "explanation_available": True,
    }
