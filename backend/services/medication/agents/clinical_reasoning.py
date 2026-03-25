"""
Clinical Reasoning Agent: analyze patient context and summarize diabetic state, risk factors, treatment goals, contraindication signals.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from app.schemas.medication_recommendation import ClinicalReasoningOutput
from services.llm import generate as llm_generate

logger = logging.getLogger(__name__)

AGENT_NAME = "clinical_reasoning_agent"

SYSTEM_PROMPT = """You are a clinical reasoning assistant for diabetes care. Your only job is to analyze the given patient context and output a structured summary.

Output valid JSON only, no markdown or extra text. Use this exact structure:
{
  "clinical_summary": "2-4 sentence summary of the patient's diabetic state and key context",
  "key_risk_factors": ["risk factor 1", "risk factor 2"],
  "treatment_goals": ["goal 1", "goal 2"],
  "contraindication_signals": ["any condition, allergy, or factor that should limit medication choices"],
  "reasoning": "Brief reasoning for the summary"
}

Do not suggest specific medications. Do not diagnose. Only summarize and list risk factors, goals, and caution signals."""


def _build_user_prompt(context: Dict[str, Any]) -> str:
    parts = [
        "Patient context:",
        f"Age: {context.get('age', 'unknown')}, Sex: {context.get('sex', 'unknown')}",
        f"BMI: {context.get('BMI', 'unknown')}, HbA1c: {context.get('HbA1c', 'unknown')}, Fasting glucose: {context.get('fasting_glucose', 'unknown')}",
        f"Diabetes type: {context.get('diabetes_type', 'unknown')}, Risk score: {context.get('risk_score', 'unknown')}",
        f"Conditions: {context.get('conditions', [])}",
        f"Current medications: {context.get('current_medications', [])}",
        f"Allergies: {context.get('allergies', [])}",
        f"Renal status: {context.get('renal_status', 'unknown')}, BP: {context.get('bp', 'unknown')}, Cholesterol: {context.get('cholesterol', 'unknown')}",
    ]
    return "\n".join(parts)


def run_clinical_reasoning(
    context: Dict[str, Any],
    provider: Optional[str] = None,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    event_callback: Optional[Any] = None,
) -> ClinicalReasoningOutput:
    """Run the clinical reasoning agent; returns structured ClinicalReasoningOutput."""
    user = _build_user_prompt(context)
    raw = llm_generate(
        system=SYSTEM_PROMPT,
        user=user,
        provider=provider,
        request_id=request_id,
        patient_id=patient_id,
        event_callback=event_callback,
        temperature=0.3,
    )
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if "\n" in raw:
            lines = raw.split("\n")
            if lines and "json" in lines[0].lower():
                raw = "\n".join(lines[1:])
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.exception("Clinical reasoning agent returned invalid JSON: %s", e)
        raise ValueError("Clinical reasoning agent did not return valid JSON") from e
    return ClinicalReasoningOutput(
        clinical_summary=data.get("clinical_summary", ""),
        key_risk_factors=data.get("key_risk_factors") or [],
        treatment_goals=data.get("treatment_goals") or [],
        contraindication_signals=data.get("contraindication_signals") or [],
        reasoning=data.get("reasoning", ""),
    )
