"""
Consensus Agent: combine clinical reasoning, validated medications, and safety output into final decision-support response.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.schemas.medication_recommendation import (
    ClinicalReasoningOutput,
    ConsensusOutput,
    SafetyValidationOutput,
)
from services.llm import generate as llm_generate

logger = logging.getLogger(__name__)

AGENT_NAME = "consensus_agent"

SYSTEM_PROMPT = """You are a clinical decision-support consensus assistant for diabetes care. You receive:
1. Clinical reasoning summary and treatment goals
2. Validated medications (already safety-checked) with reasons
3. Any removed medications and safety notes

Your job is to produce a final decision-support output. Do NOT prescribe; only recommend for clinician consideration.

Output valid JSON only, no markdown or extra text. Use this exact structure:
{
  "recommended_medications": [
    { "name": "...", "reason": "...", "priority": 1 }
  ],
  "final_reasoning": "2-4 sentence explanation of why these options for this patient",
  "warnings": ["any remaining warnings to show the clinician"],
  "confidence_score": 0.0
}

confidence_score must be between 0 and 1. Use lower confidence if data is limited or many candidates were removed. recommended_medications should be ordered by priority (1 = primary suggestion)."""


def _build_user_prompt(
    clinical: ClinicalReasoningOutput,
    safety: SafetyValidationOutput,
) -> str:
    parts = [
        "Clinical summary:", clinical.clinical_summary,
        "Treatment goals:", str(clinical.treatment_goals),
        "Validated medications (safe to suggest):",
    ]
    for v in safety.validated_medications:
        if isinstance(v, dict):
            parts.append(f"  - {v.get('name', '')}: {v.get('reason', '')}")
        else:
            parts.append(f"  - {v}")
    parts.append("Removed medications (do not recommend):")
    for r in safety.removed_medications:
        parts.append(f"  - {r.name}: {r.reason}")
    parts.append("Safety warnings: " + str(safety.warnings))
    parts.append("Safety notes: " + safety.safety_notes)
    return "\n".join(parts)


def run_consensus(
    clinical_output: ClinicalReasoningOutput,
    safety_output: SafetyValidationOutput,
    provider: Optional[str] = None,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    event_callback: Optional[Any] = None,
) -> ConsensusOutput:
    """Run the consensus agent; returns ConsensusOutput."""
    user = _build_user_prompt(clinical_output, safety_output)
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
        logger.exception("Consensus agent returned invalid JSON: %s", e)
        raise ValueError("Consensus agent did not return valid JSON") from e
    recs = data.get("recommended_medications") or []
    if not isinstance(recs, list):
        recs = []
    confidence = float(data.get("confidence_score", 0.5))
    confidence = max(0.0, min(1.0, confidence))
    return ConsensusOutput(
        recommended_medications=recs,
        final_reasoning=str(data.get("final_reasoning", "")),
        warnings=[str(w) for w in (data.get("warnings") or [])],
        confidence_score=confidence,
    )
