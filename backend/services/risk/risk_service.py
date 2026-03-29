"""
Risk service: run GraphSAGE prediction and graph explanation, return combined payload.
Used by Risk Assessment tab (GET /risk/{id}/explain) and by coordinator.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from .graph_explainer import explain_risk_prediction
from .prediction_service import predict_patient_risk

logger = logging.getLogger(__name__)


def get_risk_with_explanation(patient_id: str) -> Dict[str, Any]:
    """
    Run GraphSAGE prediction, then graph explanation; return one combined payload.
    """
    prediction = predict_patient_risk(patient_id)
    explanation = explain_risk_prediction(patient_id, prediction)
    return {
        "patient_id": patient_id,
        "risk_score": prediction["risk_score"],
        "risk_label": prediction["risk_label"],
        "model_name": prediction["model_name"],
        "predicted_at": prediction["predicted_at"],
        "explanation_available": True,
        "explanation": explanation,
    }
