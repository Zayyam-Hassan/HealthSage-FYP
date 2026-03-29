"""
Safety Validator Agent: validate medication candidates against patient context; remove unsuitable ones.
If this agent fails, the pipeline must not return a high-confidence final recommendation.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.schemas.medication_recommendation import CandidateGeneratorOutput, RemovedMedication, SafetyValidationOutput
from services.llm import generate as llm_generate

logger = logging.getLogger(__name__)

AGENT_NAME = "safety_validator_agent"

SYSTEM_PROMPT = """You are a medication safety validation assistant for diabetes care. You receive candidate medications and patient context. Your job is to:
1. Check each candidate against contraindication signals, allergies, current medications, and renal/cardiac context.
2. Keep validated_medications: list of candidates that are safe to suggest (each item: { "name": "...", "reason": "why safe or caution" }).
3. Put any candidate that must be removed into removed_medications: list of { "name": "...", "reason": "why removed" }.
4. List any warnings in warnings: [].
5. Add safety_notes: short summary.

Output valid JSON only, no markdown or extra text. Use this exact structure:
{
  "validated_medications": [ { "name": "...", "reason": "..." } ],
  "removed_medications": [ { "name": "...", "reason": "..." } ],
  "warnings": ["warning 1", "warning 2"],
  "safety_notes": "..."
}

If in doubt about a drug given contraindications or interactions, remove it and state the reason. Do not keep unsafe candidates."""


def _build_user_prompt(
    candidates: CandidateGeneratorOutput,
    clinical_summary: str,
    contraindication_signals: List[str],
    current_medications: List[str],
    allergies: List[str],
    renal_status: str,
) -> str:
    parts = [
        "Clinical context summary:", clinical_summary,
        "Contraindication signals:", str(contraindication_signals),
        "Current medications:", str(current_medications),
        "Allergies:", str(allergies),
        "Renal status:", renal_status,
        "Candidate medications to validate:",
    ]
    for c in candidates.candidate_medications:
        parts.append("  - %s: %s (priority %s)" % (c.name, c.reason, c.priority))
    parts.append("Generator notes: " + candidates.generator_notes)
    return "\n".join(parts)


def run_safety_validator(
    candidates: CandidateGeneratorOutput,
    context: Dict[str, Any],
    clinical_summary: str,
    provider: Optional[str] = None,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    event_callback: Optional[Any] = None,
) -> SafetyValidationOutput:
    """Run the safety validator agent. Raises on parse failure; caller must treat failure as degraded response."""
    user = _build_user_prompt(
        candidates,
        clinical_summary,
        context.get("contraindication_signals", []) if isinstance(context.get("contraindication_signals"), list) else [],
        context.get("current_medications") or [],
        context.get("allergies") or [],
        str(context.get("renal_status", "unknown")),
    )
    raw = llm_generate(
        system=SYSTEM_PROMPT,
        user=user,
        provider=provider,
        request_id=request_id,
        patient_id=patient_id,
        event_callback=event_callback,
        temperature=0.2,
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
        logger.exception("Safety validator returned invalid JSON: %s", e)
        raise ValueError("Safety validator did not return valid JSON") from e
    validated = []
    for v in data.get("validated_medications") or []:
        if isinstance(v, dict) and v.get("name"):
            validated.append({"name": str(v["name"]), "reason": str(v.get("reason", ""))})
    removed = []
    for r in data.get("removed_medications") or []:
        if isinstance(r, dict) and r.get("name"):
            removed.append(RemovedMedication(name=str(r["name"]), reason=str(r.get("reason", ""))))
    return SafetyValidationOutput(
        validated_medications=validated,
        removed_medications=removed,
        warnings=[str(w) for w in (data.get("warnings") or [])],
        safety_notes=str(data.get("safety_notes", "")),
    )
