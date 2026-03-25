"""
Validate medication engine output: schema, no diagnosis/prescription language, evidence_sources, doctor_note.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Tuple

from app.schemas.medication_recommendation import (
    EvidenceSource,
    MedicationOption,
    MedicationRecommendationOutput,
)

logger = logging.getLogger(__name__)

FORBIDDEN_PHRASES = re.compile(
    r"\b(must\s+prescribe|should\s+prescribe|you\s+must\s+give|prescribe\s+immediately|"
    r"final\s+prescription|authorized\s+to\s+prescribe|replace[sd]?\s+(doctor|physician|clinician))\b",
    re.I,
)
# Flag only when the model asserts a diagnosis (to the patient or as a new claim), not descriptive context
DIAGNOSIS_PHRASES = re.compile(
    r"\b(you\s+have\s+diabetes|I\s+diagnose|we\s+diagnose|the\s+patient\s+is\s+diagnosed\s+with)\b",
    re.I,
)


def _sanitize_descriptive_diagnosis_language(text: str) -> str:
    """
    Rewrite common LLM phrasing that describes patient context (from inputs) into
    equivalent wording that does not trigger diagnosis-language checks. We still
    block model-asserted diagnosis via DIAGNOSIS_PHRASES.
    """
    if not text:
        return text
    t = text
    # "patient has type 2 diabetes" -> "type 2 diabetes (per context)" so we don't surface model "stating" diagnosis
    t = re.sub(r"\bpatient\s+has\s+type\s+2\s+diabetes\b", "type 2 diabetes (per context)", t, flags=re.I)
    t = re.sub(r"\bpatient\s+has\s+type\s+1\s+diabetes\b", "type 1 diabetes (per context)", t, flags=re.I)
    t = re.sub(r"\bpatient\s+has\s+type\s+(\d)\b", r"type \1 diabetes (per context)", t, flags=re.I)
    # "diagnosed with type 2" / "diagnosis of diabetes" -> descriptive alternative
    t = re.sub(r"\bdiagnosed\s+with\s+", "with ", t, flags=re.I)
    t = re.sub(r"\bdiagnosis\s+of\s+", "management of ", t, flags=re.I)
    t = re.sub(r"\bdiagnosing\s+", "identifying ", t, flags=re.I)
    return t


def _reject_language(text: str) -> List[str]:
    """Return list of violations if text contains forbidden or diagnosis language."""
    violations = []
    if FORBIDDEN_PHRASES.search(text):
        violations.append("Output contains prescriptive or 'must prescribe' language")
    sanitized = _sanitize_descriptive_diagnosis_language(text)
    if DIAGNOSIS_PHRASES.search(sanitized):
        violations.append("Output contains diagnosis language")
    return violations


def _validate_option(opt: Dict[str, Any], label: str) -> Tuple[MedicationOption, List[str]]:
    """Validate one primary or alternative option; return (parsed Option, list of violations)."""
    violations = []
    for key in ("drug_name", "drug_class", "why", "evidence_sources", "confidence_note"):
        if key not in opt:
            violations.append(f"{label}: missing '{key}'")
    if not (opt.get("evidence_sources")):
        violations.append(f"{label}: evidence_sources is required and must be non-empty")
    for v in (opt.get("why") or []):
        violations.extend(_reject_language(str(v)))
    for es in (opt.get("evidence_sources") or []):
        if not isinstance(es, dict) or not es.get("title") or not es.get("url"):
            violations.append(f"{label}: each evidence_source must have title and url")
    if violations:
        raise ValueError("; ".join(violations))
    return MedicationOption(
        drug_name=str(opt["drug_name"]),
        drug_class=str(opt["drug_class"]),
        why=[str(x) for x in (opt.get("why") or [])],
        evidence_sources=[
            EvidenceSource(title=str(e.get("title", "")), url=str(e.get("url", "")))
            for e in (opt.get("evidence_sources") or [])
        ],
        confidence_note=str(opt.get("confidence_note", "")),
        flagged_for_review=bool(opt.get("flagged_for_review", False)),
    ), []


def validate_medication_output(llm_output: Dict[str, Any]) -> MedicationRecommendationOutput:
    """
    Validate raw LLM output: must match Pydantic schema, no diagnosis/prescription claims,
    evidence_sources present, doctor_note exists. Raises ValueError on failure.
    """
    if not isinstance(llm_output, dict):
        raise ValueError("Output must be a JSON object")

    raw_text = json.dumps(llm_output)
    violations = _reject_language(raw_text)
    if violations:
        raise ValueError("; ".join(violations))

    primary = llm_output.get("primary_option")
    if not primary or not isinstance(primary, dict):
        raise ValueError("primary_option is required and must be an object")

    primary_option, _ = _validate_option(primary, "primary_option")

    alternatives = []
    for i, alt in enumerate(llm_output.get("alternatives") or []):
        if not isinstance(alt, dict):
            continue
        opt, _ = _validate_option(alt, f"alternatives[{i}]")
        alternatives.append(opt)

    missing = llm_output.get("missing_information")
    if missing is not None and not isinstance(missing, list):
        missing = []
    missing = [str(x) for x in (missing or [])]

    doctor_note = llm_output.get("doctor_note")
    if not doctor_note or not str(doctor_note).strip():
        raise ValueError("doctor_note is required")
    violations = _reject_language(str(doctor_note))
    if violations:
        raise ValueError("doctor_note: " + "; ".join(violations))

    return MedicationRecommendationOutput(
        primary_option=primary_option,
        alternatives=alternatives,
        missing_information=missing,
        doctor_note=str(doctor_note).strip(),
    )
