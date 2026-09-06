"""
POST /explain-risk: full explainability payload for dashboard and chatbot.
Returns prediction, risk_label, and structured explanation (top features, nodes,
relationships, reasoning paths, visual subgraph, clinical summary).
Optionally stores risk + explanation in risk_predictions.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.db import get_db
from app.schemas.explainability import ExplainRiskRequest, ExplainRiskResponse, RiskExplanationOut

router = APIRouter(tags=["explainability"])


def _risk_label_to_predicted_label(risk_label: str) -> int:
    """Map risk_label string to predicted_label (0 = low, 1 = moderate/high)."""
    if not risk_label:
        return 0
    r = risk_label.strip().lower()
    if "low" in r:
        return 0
    return 1


@router.post("/explain-risk", response_model=ExplainRiskResponse)
def explain_risk(
    payload: ExplainRiskRequest,
    store: bool = Query(True, description="Store risk + explanation in risk_predictions"),
):
    """
    Run risk prediction and full explanation for a patient.
    Supports model_type: graphsage | hgt.
    Returns unified payload for explanation dashboard and chatbot reuse.
    When store=true (default), persists prediction and explanation to risk_predictions.
    """
    try:
        from services.explainability import run_explain_risk
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Explainability module unavailable: {e}") from e
    try:
        full = run_explain_risk(payload.patient_id, payload.model_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {e}") from e
    explanation = RiskExplanationOut(
        patient_id=full.get("patient_id"),
        model_type=full.get("model_type", "graphsage"),
        risk_prediction=full.get("risk_prediction", 0.0),
        risk_label=full.get("risk_label", ""),
        clinical_summary=full.get("clinical_summary", ""),
        top_features=full.get("top_features", []),
        important_nodes=full.get("important_nodes", []),
        important_relationships=full.get("important_relationships", []),
        reasoning_paths=full.get("reasoning_paths", []),
        visual_subgraph=full.get("visual_subgraph", {"nodes": [], "edges": []}),
    )
    if store:
        try:
            from bson import ObjectId
            db = get_db()
            oid = ObjectId(payload.patient_id)
            risk_label = full.get("risk_label", "Low Risk")
            doc = {
                "patient_id": oid,
                "model_name": full.get("model_type", "graphsage"),
                "probability": float(full.get("risk_prediction", 0.0)),
                "predicted_label": _risk_label_to_predicted_label(risk_label),
                "explanation": full,
            }
            db.risk_predictions.insert_one(doc)
        except Exception:
            pass
    return ExplainRiskResponse(
        prediction=float(full.get("risk_prediction", 0.0)),
        risk_label=full.get("risk_label", "Low Risk"),
        explanation=explanation,
    )
