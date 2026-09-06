"""Build patient context from MongoDB for lifestyle recommendations."""
from datetime import datetime
from typing import Any, Dict

from bson import ObjectId
from pymongo import MongoClient

from app.db import get_db, parse_patient_oid


def build_patient_context(patient_id: str) -> Dict[str, Any]:
    """
    Build context from MongoDB: patient doc + observations (latest/mean per code).
    Raises ValueError if patient_id not found.
    """
    db = get_db()
    oid = parse_patient_oid(patient_id)
    patient = db.patients.find_one({"_id": oid})
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")

    # Aggregate observations by code (use mean if multiple)
    obs_cursor = db.observations.find({"patient_id": oid})
    by_code: Dict[str, list] = {}
    for o in obs_cursor:
        code = o.get("observation_code") or ""
        if o.get("value_numeric") is not None:
            by_code.setdefault(code, []).append(float(o["value_numeric"]))

    def mean_or_none(code: str) -> float | None:
        vals = by_code.get(code)
        if not vals:
            return None
        return sum(vals) / len(vals)

    hba1c = mean_or_none("HBA1C")
    glucose = mean_or_none("RANDOM_GLUCOSE") or mean_or_none("FASTING_GLUCOSE")
    bmi = mean_or_none("BMI") or patient.get("bmi")
    if bmi is None and patient.get("height_cm") and patient.get("weight_kg"):
        h, w = float(patient["height_cm"]), float(patient["weight_kg"])
        if h > 0:
            bmi = round(w / ((h / 100) ** 2), 2)

    return {
        "patient_id": patient_id,
        "full_name": patient.get("full_name"),
        "age": patient.get("age"),
        "sex": patient.get("sex"),
        "BMI": bmi,
        "HbA1c": hba1c,
        "glucose": glucose,
        "cholesterol": mean_or_none("TOTAL_CHOLESTEROL"),
        "systolic_bp": mean_or_none("SYSTOLIC_BP") or mean_or_none("BLOOD_PRESSURE_SYSTOLIC"),
        "diastolic_bp": mean_or_none("DIASTOLIC_BP") or mean_or_none("BLOOD_PRESSURE_DIASTOLIC"),
        "activity_level": None,
        "smoker": False,
        "risk_score": None,
        "snapshot_at": datetime.utcnow().isoformat() + "Z",
    }
