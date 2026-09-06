"""
Doctor vs model comparison: reflective diff of doctor assessment and model outputs.
Never ranks doctor judgment against the model.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def compute_doctor_vs_model_diff(
    doctor_assessment: Dict[str, Any],
    model_outputs: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Compare doctor planned medications/lifestyle vs model primary/alternatives and lifestyle plan.
    Returns reflective summary only; does not state that the model is superior.
    """
    doc_meds: List[str] = list(doctor_assessment.get("planned_medications") or [])
    doc_lifestyle: List[str] = list(doctor_assessment.get("planned_lifestyle") or [])

    med_data = model_outputs.get("medication") or {}
    if isinstance(med_data, dict) and "data" in med_data:
        med_data = med_data["data"]
    primary = (med_data.get("primary_option") or {}).get("drug_name", "")
    alts = [a.get("drug_name") for a in (med_data.get("alternatives") or []) if a.get("drug_name")]

    lifestyle_data = model_outputs.get("lifestyle") or {}
    if isinstance(lifestyle_data, dict) and "data" in lifestyle_data:
        plan = (lifestyle_data.get("data") or {}).get("plan") or {}
    else:
        plan = {}
    model_lifestyle_items: List[str] = []
    for key in ("diet", "activity", "sleep", "other"):
        for item in (plan.get(key) or []):
            if isinstance(item, str):
                model_lifestyle_items.append(item)
            elif isinstance(item, dict) and item.get("text"):
                model_lifestyle_items.append(item["text"])

    # Medication diff summary
    med_match = primary in doc_meds if primary else False
    if not doc_meds and not primary:
        medication_diff_summary = "No medication plan or model primary to compare."
    elif not doc_meds:
        medication_diff_summary = f"Model suggests {primary} as primary with alternatives {alts}. Doctor plan not provided for comparison."
    elif not primary:
        medication_diff_summary = f"Doctor plan: {doc_meds}. Model did not return a primary option."
    elif med_match and not alts:
        medication_diff_summary = "Doctor plan matches model primary option."
    elif med_match:
        medication_diff_summary = f"Doctor plan matches primary option ({primary}). Model also lists alternatives: {alts}."
    else:
        medication_diff_summary = f"Doctor plan: {doc_meds}. Model primary: {primary}, alternatives: {alts}. Differences are for clinician review."

    # Lifestyle diff summary
    if not doc_lifestyle and not model_lifestyle_items:
        lifestyle_diff_summary = "No lifestyle plan or model output to compare."
    elif not doc_lifestyle:
        lifestyle_diff_summary = f"Model output includes {len(model_lifestyle_items)} recommendation(s). Doctor plan not provided for comparison."
    elif not model_lifestyle_items:
        lifestyle_diff_summary = f"Doctor plan: {doc_lifestyle}. Model did not return lifestyle items."
    else:
        lifestyle_diff_summary = (
            f"Doctor plan: {len(doc_lifestyle)} item(s). Model output: {len(model_lifestyle_items)} item(s). "
            "Compare for specificity and evidence alignment; clinician judgment is final."
        )

    return {
        "medication_diff": {
            "doctor_plan": doc_meds,
            "model_primary": primary,
            "model_alternatives": alts,
            "difference_summary": medication_diff_summary,
        },
        "lifestyle_diff": {
            "doctor_plan": doc_lifestyle,
            "model_plan": model_lifestyle_items[:15],
            "difference_summary": lifestyle_diff_summary,
        },
        "doctor_note": "This comparison is reflective only and does not rank doctor judgment against the model.",
    }
