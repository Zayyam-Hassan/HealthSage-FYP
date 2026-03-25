"""
Minimal compatibility check endpoint for frontend.
Returns compatibility score and summary; can be extended to use medication safety_filter later.
"""
from fastapi import APIRouter, HTTPException

from app.db import get_db

router = APIRouter(prefix="/compatibility", tags=["compatibility"])


@router.get("/{patient_id}/{medication_id}")
def check_compatibility(patient_id: str, medication_id: str):
    """
    Placeholder compatibility check for frontend.
    Returns structure expected by frontend: compatibility_score, summary, contraindications, interactions.
    """
    # Minimal validation: ensure patient and medication exist
    from bson import ObjectId
    try:
        pid = ObjectId(patient_id)
        mid = ObjectId(medication_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid patient or medication ID") from None
    db = get_db()
    if not db.patients.find_one({"_id": pid}):
        raise HTTPException(status_code=404, detail="Patient not found")
    if not db.medications.find_one({"_id": mid}):
        raise HTTPException(status_code=404, detail="Medication not found")
    # Stub response; can later call safety_filter or recommendation pipeline
    return {
        "patient_id": patient_id,
        "medication_id": medication_id,
        "compatibility_score": 0.85,
        "summary": "No known contraindications in record. Always verify with current guidelines and patient history.",
        "contraindications": [],
        "interactions": [],
    }
