# Medication Candidate Generator Agent
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.schemas.medication_recommendation import (
    CandidateGeneratorOutput,
    ClinicalReasoningOutput,
    MedicationCandidateItem,
)
from services.llm import generate as llm_generate

logger = logging.getLogger(__name__)

AGENT_NAME = "medication_candidate_generator_agent"

SYSTEM_PROMPT = """You are a medication candidate suggestion assistant for diabetes care. Based on the clinical summary and treatment goals, suggest candidate medications (drug names) with brief reason and priority. Do NOT finalize prescriptions; only propose candidates for later safety validation.

Output valid JSON only. Use this structure:
{
  "candidate_medications": [
    { "name": "Medication name", "reason": "Why consider this", "priority": 1 }
  ],
  "generator_notes": "Optional note"
}
Do not exceed 6 candidates. priority 1 = highest."""


def _build_user_prompt(clinical: ClinicalReasoningOutput, evidence_block: str = "") -> str:
    parts = [
        "Clinical summary:", clinical.clinical_summary,
        "Key risk factors:", str(clinical.key_risk_factors),
        "Treatment goals:", str(clinical.treatment_goals),
        "Contraindication signals:", str(clinical.contraindication_signals),
        "Reasoning:", clinical.reasoning,
    ]
    if evidence_block:
        parts.extend(["Retrieved evidence:", evidence_block])
    return "\n".join(parts)


def run_candidate_generator(
    clinical_output: ClinicalReasoningOutput,
    evidence_block: str = "",
    provider: Optional[str] = None,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    event_callback: Optional[Any] = None,
) -> CandidateGeneratorOutput:
    user = _build_user_prompt(clinical_output, evidence_block)
    raw = llm_generate(
        system=SYSTEM_PROMPT,
        user=user,
        provider=provider,
        request_id=request_id,
        patient_id=patient_id,
        event_callback=event_callback,
        temperature=0.4,
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
        logger.exception("Candidate generator invalid JSON: %s", e)
        raise ValueError("Candidate generator did not return valid JSON") from e
    candidates = []
    for c in data.get("candidate_medications") or []:
        if isinstance(c, dict) and c.get("name"):
            prio = c.get("priority", 1)
            if not isinstance(prio, (int, float)):
                prio = 1
            candidates.append(MedicationCandidateItem(
                name=str(c["name"]),
                reason=str(c.get("reason", "")),
                priority=int(prio),
            ))
    return CandidateGeneratorOutput(
        candidate_medications=candidates,
        generator_notes=str(data.get("generator_notes", "")),
    )
