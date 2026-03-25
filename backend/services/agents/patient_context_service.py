"""
Build full patient context when a doctor opens the chatbot for a patient (or patient logs in).
Runs risk, loads latest lifestyle/medication recommendations from DB, returns one payload for the UI.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId
from pymongo import MongoClient

from app.db import get_db, parse_patient_oid
from services.medication.context_builder import (
    build_context_summary,
    build_medication_context,
    build_tailoring_summary,
)

logger = logging.getLogger(__name__)


def _serialize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Convert ObjectId and datetime for JSON."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = _serialize_doc(v)
        else:
            out[k] = v
    return out


def build_patient_session_context(patient_id: str) -> Dict[str, Any]:
    """
    Build full context for the patient when doctor opens chatbot or patient logs in.
    - Medication/lifestyle context from MongoDB (demographics, labs, conditions, etc.)
    - GraphSAGE risk prediction + explanation
    - Latest lifestyle recommendation (if any) from medication_recommendations / lifestyle
    - Latest medication recommendation (if any)
    Returns one payload the frontend can use to show summary and "last recommendations".
    """
    oid = parse_patient_oid(patient_id)
    db = get_db()
    patient = db.patients.find_one({"_id": oid})
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")

    # 1. Full clinical context (same as medication engine)
    try:
        context = build_medication_context(patient_id)
    except Exception as e:
        logger.warning("build_medication_context failed: %s", e)
        context = {"patient_id": patient_id}

    # 2. Risk prediction + explanation
    risk_snapshot: Dict[str, Any] = {}
    try:
        from services.risk.risk_service import get_risk_with_explanation
        risk_snapshot = get_risk_with_explanation(patient_id)
        context["risk_score"] = risk_snapshot.get("risk_score")
    except Exception as e:
        logger.warning("Risk build failed: %s", e)

    # 3. Latest lifestyle recommendation from DB (we don't have a dedicated collection for lifestyle
    #    like medication_recommendations; lifestyle service returns in-memory. So we check
    #    medication_recommendations and any stored lifestyle. If there's a lifestyle_recommendations
    #    collection we could use it.)
    latest_lifestyle: Optional[Dict[str, Any]] = None
    try:
        lifestyle_doc = db.lifestyle_recommendations.find_one(
            {"patient_id": oid},
            sort=[("created_at", -1)],
            projection={"plan": 1, "created_at": 1, "_id": 1},
        )
        if lifestyle_doc:
            latest_lifestyle = _serialize_doc(lifestyle_doc)
    except Exception as e:
        logger.warning("Latest lifestyle lookup failed: %s", e)

    # 4. Latest medication recommendation from DB
    latest_medication: Optional[Dict[str, Any]] = None
    try:
        med_doc = db.medication_recommendations.find_one(
            {"patient_id": oid},
            sort=[("created_at", -1)],
            projection={
                "validated_output": 1,
                "safety_flags": 1,
                "created_at": 1,
                "_id": 1,
            },
        )
        if med_doc:
            latest_medication = _serialize_doc(med_doc)
    except Exception as e:
        logger.warning("Latest medication lookup failed: %s", e)

    # 5. Human-readable summary and tailoring hint
    context_summary = build_context_summary(context)
    tailoring_summary = build_tailoring_summary(context)

    return {
        "patient_id": patient_id,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "context": context,
        "context_summary": context_summary,
        "tailoring_summary": tailoring_summary,
        "risk_snapshot": risk_snapshot,
        "latest_lifestyle": latest_lifestyle,
        "latest_medication": latest_medication,
        "patient_display": {
            "full_name": patient.get("full_name"),
            "age": patient.get("age"),
            "sex": patient.get("sex"),
        },
    }
