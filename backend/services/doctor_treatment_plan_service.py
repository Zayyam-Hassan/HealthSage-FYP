from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.db import get_db, parse_patient_oid


def _serialize_datetime(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    return None


def _clean_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _map_assessment(data: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    data = data or {}
    return {
        "diagnosis": _clean_text(data.get("diagnosis")),
        "clinical_impression": _clean_text(data.get("clinical_impression")),
        "risk_assessment": _clean_text(data.get("risk_assessment")),
        "treatment_goal": _clean_text(data.get("treatment_goal")),
        "follow_up_note": _clean_text(data.get("follow_up_note")),
        "rationale": _clean_text(data.get("rationale")),
    }


def _map_lifestyle(data: Optional[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    data = data or {}
    return {
        "diet_plan": _clean_text(data.get("diet_plan")),
        "exercise_plan": _clean_text(data.get("exercise_plan")),
        "sleep_guidance": _clean_text(data.get("sleep_guidance")),
        "stress_guidance": _clean_text(data.get("stress_guidance")),
        "monitoring_guidance": _clean_text(data.get("monitoring_guidance")),
        "general_lifestyle_note": _clean_text(data.get("general_lifestyle_note")),
    }


def _map_medications(items: List[Dict[str, Any]] | None) -> List[Dict[str, Any]]:
    output: List[Dict[str, Any]] = []
    for item in items or []:
        output.append(
            {
                "id": str(item.get("_id")) if item.get("_id") else "",
                "medication_name": _clean_text(item.get("medication_name")),
                "dosage": _clean_text(item.get("dosage")),
                "frequency": _clean_text(item.get("frequency")),
                "route": _clean_text(item.get("route")),
                "duration": _clean_text(item.get("duration")),
                "timing_instructions": _clean_text(item.get("timing_instructions")),
                "special_instructions": _clean_text(item.get("special_instructions")),
                "status": _clean_text(item.get("status")) or "active",
                "created_at": _serialize_datetime(item.get("created_at")),
                "updated_at": _serialize_datetime(item.get("updated_at")),
            }
        )
    return output


def get_active_doctor_treatment_plan(patient_id: str) -> Optional[Dict[str, Any]]:
    oid = parse_patient_oid(patient_id)
    db = get_db()

    patient = db.patients.find_one({"_id": oid}, {"full_name": 1})
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")

    plan = db.doctor_treatment_plans.find_one(
        {"patient_id": oid, "status": "active"},
        sort=[("updated_at", -1), ("created_at", -1)],
    )
    if not plan:
        return None

    doctor_id = plan.get("doctor_id")
    doctor = None
    if isinstance(doctor_id, ObjectId):
        doctor = db.doctors.find_one({"_id": doctor_id}, {"name": 1})

    return {
        "id": str(plan.get("_id")),
        "patient_id": str(plan.get("patient_id")),
        "doctor_id": str(doctor_id) if doctor_id else None,
        "patient_name": patient.get("full_name"),
        "doctor_name": doctor.get("name") if doctor else None,
        "status": _clean_text(plan.get("status")) or "active",
        "assessment": _map_assessment(plan.get("assessment")),
        "medications": _map_medications(plan.get("medications")),
        "lifestyle_plan": _map_lifestyle(plan.get("lifestyle_plan")),
        "doctor_note": _clean_text(plan.get("doctor_note")),
        "discontinued_at": _serialize_datetime(plan.get("discontinued_at")),
        "created_at": _serialize_datetime(plan.get("created_at")),
        "updated_at": _serialize_datetime(plan.get("updated_at")),
    }


def build_doctor_treatment_summary(plan: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not plan:
        return {
            "summary": "No active doctor-authored treatment plan is stored for this patient.",
            "medication_names": [],
            "lifestyle_sections": [],
        }

    assessment = plan.get("assessment") or {}
    lifestyle = plan.get("lifestyle_plan") or {}
    medications = plan.get("medications") or []

    medication_names = [
        item.get("medication_name")
        for item in medications
        if item.get("medication_name")
    ]
    lifestyle_sections = [
        label
        for label, value in [
            ("diet", lifestyle.get("diet_plan")),
            ("exercise", lifestyle.get("exercise_plan")),
            ("sleep", lifestyle.get("sleep_guidance")),
            ("stress", lifestyle.get("stress_guidance")),
            ("monitoring", lifestyle.get("monitoring_guidance")),
        ]
        if value
    ]

    summary_parts: List[str] = []
    if assessment.get("diagnosis"):
        summary_parts.append(f"Diagnosis: {assessment.get('diagnosis')}.")
    if assessment.get("treatment_goal"):
        summary_parts.append(f"Goal: {assessment.get('treatment_goal')}.")
    if medication_names:
        summary_parts.append(f"Medications: {', '.join(medication_names)}.")
    if lifestyle_sections:
        summary_parts.append(
            f"Lifestyle guidance covers {', '.join(lifestyle_sections)}."
        )
    if assessment.get("follow_up_note"):
        summary_parts.append(f"Follow-up: {assessment.get('follow_up_note')}.")

    return {
        "summary": " ".join(summary_parts) or "Doctor-authored treatment plan loaded.",
        "medication_names": medication_names,
        "lifestyle_sections": lifestyle_sections,
    }


def build_doctor_treatment_message(plan: Optional[Dict[str, Any]]) -> str:
    if not plan:
        return (
            "No active doctor-authored treatment plan is currently stored for this patient. "
            "If the clinician saves one in the treatment plan module, I can summarize it here."
        )

    assessment = plan.get("assessment") or {}
    lifestyle = plan.get("lifestyle_plan") or {}
    medications = plan.get("medications") or []

    lines: List[str] = []
    lines.append("Current doctor-authored treatment plan:")

    if assessment.get("diagnosis"):
        lines.append(f"- Diagnosis: {assessment.get('diagnosis')}")
    if assessment.get("clinical_impression"):
        lines.append(f"- Clinical impression: {assessment.get('clinical_impression')}")
    if assessment.get("risk_assessment"):
        lines.append(f"- Risk assessment: {assessment.get('risk_assessment')}")
    if assessment.get("treatment_goal"):
        lines.append(f"- Treatment goal: {assessment.get('treatment_goal')}")

    if medications:
        lines.append("- Medications:")
        for item in medications:
            med_parts = [
                item.get("medication_name"),
                item.get("dosage"),
                item.get("frequency"),
                item.get("route"),
                item.get("duration"),
            ]
            med_text = ", ".join(part for part in med_parts if part)
            timing = item.get("timing_instructions")
            if timing:
                med_text = f"{med_text}, {timing}" if med_text else timing
            if item.get("special_instructions"):
                med_text = f"{med_text}. Note: {item.get('special_instructions')}"
            lines.append(f"  - {med_text}")

    lifestyle_lines = [
        ("Diet", lifestyle.get("diet_plan")),
        ("Exercise", lifestyle.get("exercise_plan")),
        ("Sleep", lifestyle.get("sleep_guidance")),
        ("Stress", lifestyle.get("stress_guidance")),
        ("Monitoring", lifestyle.get("monitoring_guidance")),
        ("Lifestyle note", lifestyle.get("general_lifestyle_note")),
    ]
    if any(value for _, value in lifestyle_lines):
        lines.append("- Lifestyle guidance:")
        for label, value in lifestyle_lines:
            if value:
                lines.append(f"  - {label}: {value}")

    if assessment.get("follow_up_note"):
        lines.append(f"- Follow-up note: {assessment.get('follow_up_note')}")
    if assessment.get("rationale"):
        lines.append(f"- Rationale: {assessment.get('rationale')}")
    if plan.get("doctor_note"):
        lines.append(f"- Doctor note: {plan.get('doctor_note')}")
    if plan.get("doctor_name") or plan.get("updated_at"):
        suffix_bits = []
        if plan.get("doctor_name"):
            suffix_bits.append(f"Doctor: {plan.get('doctor_name')}")
        if plan.get("updated_at"):
            suffix_bits.append(f"Updated: {plan.get('updated_at')}")
        lines.append(f"- {' | '.join(suffix_bits)}")

    lines.append("The clinician remains the final decision-maker.")
    return "\n".join(lines)
