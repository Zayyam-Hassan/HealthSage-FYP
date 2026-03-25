"""
Risk Assessment tab API: GraphSAGE prediction only, and prediction + explanation.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from app.db import get_db
from services.risk.prediction_service import predict_patient_risk
from services.risk.risk_service import get_risk_with_explanation

router = APIRouter(prefix="/risk", tags=["risk"])


def _risk_audit_log(patient_id: str, result: Dict[str, Any], with_explanation: bool = False) -> None:
    try:
        db = get_db()
        doc = {
            "patient_id": patient_id,
            "model_name": result.get("model_name", "GraphSAGE"),
            "prediction_result": {"risk_score": result.get("risk_score"), "risk_label": result.get("risk_label")},
            "explanation_result": result.get("explanation") if with_explanation else None,
            "created_at": datetime.now(timezone.utc),
        }
        db.risk_audit_logs.insert_one(doc)
    except Exception:
        pass


@router.get("/{patient_id}")
async def get_risk(patient_id: str):
    """
    Returns GraphSAGE prediction only (for separate Risk Assessment tab).
    """
    try:
        result = predict_patient_risk(patient_id)
        _risk_audit_log(patient_id, result, with_explanation=False)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{patient_id}/explain")
async def get_risk_explain(patient_id: str):
    """
    Returns GraphSAGE prediction plus graph/feature explanation.
    """
    try:
        result = get_risk_with_explanation(patient_id)
        _risk_audit_log(patient_id, result, with_explanation=True)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
