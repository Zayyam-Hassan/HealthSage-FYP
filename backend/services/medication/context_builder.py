"""
Build patient medication context from MongoDB for the medication recommendation engine.
Collects demographics, labs, risk score, conditions, medications, allergies, renal/BP/cholesterol.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import MongoClient

from app.db import get_db, parse_patient_oid

logger = logging.getLogger(__name__)


def _mean_or_none(vals: List[float]) -> Optional[float]:
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


def build_medication_context(patient_id: str) -> Dict[str, Any]:
    """
    Collect from MongoDB: age, sex, BMI, HbA1c, fasting glucose, diabetes type,
    GraphSAGE risk score, conditions, current medications, allergies,
    renal indicators, BP, cholesterol. Raises ValueError if patient not found.
    """
    db = get_db()
    oid = parse_patient_oid(patient_id)
    patient = db.patients.find_one({"_id": oid})
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")

    # Observations by code
    obs_cursor = db.observations.find({"patient_id": oid})
    by_code: Dict[str, List[float]] = {}
    for o in obs_cursor:
        if o.get("value_numeric") is not None:
            code = (o.get("observation_code") or "").strip()
            if code:
                by_code.setdefault(code, []).append(float(o["value_numeric"]))

    # Labs and vitals
    hba1c = _mean_or_none(by_code.get("HBA1C") or [])
    fasting_glucose = _mean_or_none(by_code.get("FASTING_GLUCOSE") or [])
    if fasting_glucose is None:
        fasting_glucose = _mean_or_none(by_code.get("RANDOM_GLUCOSE") or [])
    bmi = _mean_or_none(by_code.get("BMI") or [])
    if bmi is None and patient.get("height_cm") and patient.get("weight_kg"):
        h, w = float(patient["height_cm"]), float(patient["weight_kg"])
        bmi = round(w / ((h / 100) ** 2), 2) if h > 0 else None
    systolic = _mean_or_none(by_code.get("SYSTOLIC_BP") or by_code.get("BLOOD_PRESSURE_SYSTOLIC") or [])
    diastolic = _mean_or_none(by_code.get("DIASTOLIC_BP") or by_code.get("BLOOD_PRESSURE_DIASTOLIC") or [])
    cholesterol = _mean_or_none(by_code.get("TOTAL_CHOLESTEROL") or [])

    # Renal: e.g. eGFR, creatinine if present
    egfr = _mean_or_none(by_code.get("eGFR") or by_code.get("EGFR") or [])
    creatinine = _mean_or_none(by_code.get("CREATININE") or [])
    if egfr is not None:
        renal_status = "reduced" if egfr < 60 else "normal"
    elif creatinine is not None:
        renal_status = "unknown"  # could derive from creatinine
    else:
        renal_status = "unknown"

    # Conditions (active)
    conditions_docs = list(db.conditions.find({"patient_id": oid, "status": "active"}))
    conditions = [
        (c.get("display_name") or c.get("code") or "").strip().lower()
        for c in conditions_docs
        if (c.get("display_name") or c.get("code"))
    ]
    if not conditions:
        conditions = list(patient.get("conditions") or []) if isinstance(patient.get("conditions"), list) else []

    # Current medications / allergies: from patient doc or dedicated collections if present
    current_medications: List[str] = list(patient.get("current_medications") or []) if isinstance(patient.get("current_medications"), list) else []
    allergies: List[str] = list(patient.get("allergies") or []) if isinstance(patient.get("allergies"), list) else []
    diabetes_type: Optional[str] = (patient.get("diabetes_type") or patient.get("diabetes_type_code") or "").strip() or None
    if not diabetes_type and by_code.get("DIABETES_LABEL"):
        diabetes_type = "T2DM"  # infer from label if present

    # GraphSAGE risk score (probability)
    risk_score: Optional[float] = None
    try:
        from services.prediction.service import predict_graphsage_by_mongo_id
        result = predict_graphsage_by_mongo_id(patient_id)
        risk_score = result.get("probability")
    except Exception as e:
        logger.warning("Could not get GraphSAGE risk score: %s", e)

    bp_str = "unknown"
    if systolic is not None and diastolic is not None:
        bp_str = f"{int(systolic)}/{int(diastolic)}"

    return {
        "patient_id": patient_id,
        "age": patient.get("age"),
        "sex": (patient.get("sex") or "").strip().lower() or None,
        "BMI": bmi,
        "HbA1c": hba1c,
        "fasting_glucose": fasting_glucose,
        "diabetes_type": diabetes_type or "unknown",
        "risk_score": risk_score,
        "conditions": conditions,
        "current_medications": current_medications,
        "allergies": allergies,
        "renal_status": renal_status,
        "bp": bp_str,
        "cholesterol": cholesterol,
    }


def build_context_summary(context: Dict[str, Any]) -> str:
    """Create a short text summary of patient context for use in Grok prompt."""
    parts = [
        f"Age: {context.get('age', 'unknown')}",
        f"Sex: {context.get('sex', 'unknown')}",
        f"BMI: {context.get('BMI', 'unknown')}",
        f"HbA1c: {context.get('HbA1c', 'unknown')}",
        f"Fasting glucose: {context.get('fasting_glucose', 'unknown')}",
        f"Diabetes type: {context.get('diabetes_type', 'unknown')}",
        f"Risk score: {context.get('risk_score', 'unknown')}",
        f"Conditions: {context.get('conditions') or []}",
        f"Current medications: {context.get('current_medications') or []}",
        f"Allergies: {context.get('allergies') or []}",
        f"Renal status: {context.get('renal_status', 'unknown')}",
        f"Blood pressure: {context.get('bp', 'unknown')}",
        f"Cholesterol: {context.get('cholesterol', 'unknown')}",
    ]
    return "\n".join(parts)


def build_tailoring_summary(context: Dict[str, Any]) -> str:
    """
    Build a short clinical summary that forces the LLM to tailor suggestions.
    Describes risk level, glycemic control, weight, comorbidities so responses differ by patient.
    """
    hba1c = context.get("HbA1c")
    bmi = context.get("BMI")
    risk = context.get("risk_score")
    conditions = context.get("conditions") or []
    current_meds = context.get("current_medications") or []
    renal = context.get("renal_status", "unknown")

    lines = []
    # Glycemic
    if hba1c is not None:
        if hba1c < 5.7:
            lines.append("Glycemic: well-controlled / prediabetic range (HbA1c < 5.7%). Lifestyle-first; medication may not be indicated.")
        elif hba1c < 7:
            lines.append("Glycemic: at or near target (HbA1c < 7%). Consider first-line monotherapy if medication indicated.")
        elif hba1c < 9:
            lines.append("Glycemic: above target (HbA1c 7–9%). Consider intensification or dual therapy.")
        else:
            lines.append("Glycemic: significantly elevated (HbA1c ≥ 9%). Consider dual therapy or intensification; weight and cardiovascular factors matter.")
    else:
        lines.append("Glycemic: HbA1c not available; suggest obtaining it.")

    # Weight / BMI
    if bmi is not None:
        if bmi >= 30:
            lines.append("Weight: obesity (BMI ≥ 30). Strongly consider weight-beneficial agents (GLP-1 RA, SGLT2i) where appropriate.")
        elif bmi >= 27:
            lines.append("Weight: overweight (BMI 27–30). Weight-beneficial agents may be considered.")
        else:
            lines.append("Weight: BMI in normal/overweight range; weight-specific agents less of a priority.")
    else:
        lines.append("Weight: BMI not available.")

    # Risk score (GraphSAGE)
    if risk is not None:
        if risk < 0.3:
            lines.append("Diabetes risk score: low. Options can favor simplicity and lifestyle emphasis.")
        elif risk < 0.7:
            lines.append("Diabetes risk score: moderate. Balance efficacy and tolerability.")
        else:
            lines.append("Diabetes risk score: high. Prioritize evidence-based intensification and cardiovascular/renal benefits where applicable.")

    # Comorbidities
    if conditions:
        cond_str = ", ".join(conditions[:5])
        lines.append(f"Comorbidities: {cond_str}. Avoid or adjust for contraindications; consider cardiovascular/renal benefits (e.g. SGLT2i, GLP-1 RA) if relevant.")
    if current_meds:
        lines.append(f"Already on: {', '.join(current_meds)}. Do not suggest the same drug as primary unless adding or adjusting; consider interactions.")
    if renal == "reduced":
        lines.append("Renal: reduced function. Avoid or dose-adjust renally cleared drugs (e.g. metformin); prefer SGLT2i with eGFR criteria where indicated.")
    elif renal == "unknown":
        lines.append("Renal: status unknown. Note in missing_information and avoid assuming normal function for dosing.")

    return " ".join(lines)
