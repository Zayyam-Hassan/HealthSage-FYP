"""
Grok (LLM) medication suggestion generation. Uses patient context + retrieved evidence only.
Clinical decision support only; never prescriptive.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

# Prefer Grok-specific env; fall back to generic LLM for compatibility
GROK_API_KEY = os.getenv("GROK_API_KEY") or os.getenv("LLM_API_KEY", "")
GROK_BASE_URL = os.getenv("GROK_BASE_URL") or os.getenv("LLM_BASE_URL", "https://api.x.ai/v1/chat/completions")
GROK_MODEL = os.getenv("GROK_MODEL") or os.getenv("LLM_MODEL", "grok-2-latest")

SYSTEM_PROMPT = """You are a clinical medication suggestion assistant for diabetes care.

You must generate medication suggestions strictly based on:
1. structured patient clinical context
2. the TAILORING SUMMARY that describes this specific patient's risk, glycemic control, weight, and comorbidities
3. retrieved evidence excerpts from trusted medical sources

CRITICAL – Personalization:
- You MUST tailor your primary_option and alternatives to THIS patient. Different patients must get different suggestions.
- A healthy, low-risk patient (e.g. HbA1c 5.2, normal BMI) should get simpler, lifestyle-first or single first-line options; do NOT suggest the same intensification as for a high-risk patient.
- A high-risk patient (e.g. HbA1c > 8.5, BMI > 30) should get options that reflect intensification, weight-beneficial agents (GLP-1 RA, SGLT2i), and cardiovascular/renal benefits where appropriate.
- Use the TAILORING SUMMARY and the raw numbers (HbA1c, BMI, risk_score, conditions, current_medications) to decide. Your "why" for each option MUST reference this patient's specific numbers or profile (e.g. "Elevated HbA1c (8.4%) suggests need for intensification", "BMI 31 suggests weight-beneficial agent").
- Do NOT output a generic "Metformin first-line" for every patient regardless of context.

Rules:
- Do not diagnose
- Do not replace doctor judgment
- Do not produce final prescriptions
- Never say "must prescribe" or that the clinician must prescribe
- Only suggest medication options for clinician consideration
- Every suggestion must include reasoning (why) that is specific to this patient
- Every suggestion must include evidence_sources (title + url from the retrieved evidence)
- Output MUST be valid JSON only
- Do not invent sources; use only titles/URLs from the RETRIEVED MEDICAL EVIDENCE block
- Include a doctor_note that medication decisions must always be confirmed by the clinician
- Include missing_information when key data (e.g. renal function, allergies) is absent
"""


def _call_grok(system: str, user: str) -> str:
    if not GROK_API_KEY:
        raise RuntimeError("GROK_API_KEY or LLM_API_KEY is not set")
    payload: Dict[str, Any] = {
        "model": GROK_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.4,  # Some variation so context drives different outputs
    }
    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=90.0) as client:
        resp = client.post(GROK_BASE_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    if "choices" in data:
        content = data["choices"][0].get("message", {}).get("content", "")
    else:
        content = data.get("message", {}).get("content", "")
    return (content or "").strip()


def build_user_prompt(
    context: Dict[str, Any],
    evidence_block: str,
    tailoring_summary: str,
) -> str:
    """Build user prompt from patient context, tailoring summary, and compressed evidence."""
    return f"""TAILORING SUMMARY (use this to personalize – different patients must get different suggestions)

{tailoring_summary}

PATIENT CONTEXT (raw data)

Age: {context.get('age', 'unknown')}
Sex: {context.get('sex', 'unknown')}
BMI: {context.get('BMI', 'unknown')}
HbA1c: {context.get('HbA1c', 'unknown')}
Fasting glucose: {context.get('fasting_glucose', 'unknown')}
Diabetes type: {context.get('diabetes_type', 'unknown')}
Risk score: {context.get('risk_score', 'unknown')}
Conditions: {context.get('conditions', [])}
Current medications: {context.get('current_medications', [])}
Allergies: {context.get('allergies', [])}
Renal status: {context.get('renal_status', 'unknown')}
Blood pressure: {context.get('bp', 'unknown')}
Cholesterol: {context.get('cholesterol', 'unknown')}

RETRIEVED MEDICAL EVIDENCE

{evidence_block}

Generate a structured medication suggestion plan that is SPECIFIC to this patient's profile above. Do not give the same plan for a low-risk and a high-risk patient. Return JSON only. Use this exact structure:
{{
  "primary_option": {{
    "drug_name": "...",
    "drug_class": "...",
    "why": ["reason1", "reason2"],
    "evidence_sources": [{{"title": "...", "url": "..."}}],
    "confidence_note": "...",
    "flagged_for_review": false
  }},
  "alternatives": [
    {{ "drug_name": "...", "drug_class": "...", "why": [...], "evidence_sources": [...], "confidence_note": "...", "flagged_for_review": false }}
  ],
  "missing_information": ["gap1", "gap2"],
  "doctor_note": "Medication decisions must always be confirmed by the clinician."
}}
"""


def generate_medication_plan(
    context: Dict[str, Any],
    evidence_block: str,
    tailoring_summary: str = "",
) -> Dict[str, Any]:
    """
    Call Grok to generate structured medication suggestions from context + evidence.
    tailoring_summary should describe this patient's risk/glycemic/weight so output is personalized.
    Returns raw dict (to be validated and safety-checked). Output must be JSON.
    """
    if not tailoring_summary:
        from services.medication.context_builder import build_tailoring_summary
        tailoring_summary = build_tailoring_summary(context)
    user_prompt = build_user_prompt(context, evidence_block, tailoring_summary)
    content = _call_grok(SYSTEM_PROMPT, user_prompt)
    # Strip markdown code fence if present
    content = content.strip()
    if content.startswith("```"):
        content = content.strip("`")
        lines = content.splitlines()
        if lines and lines[0].strip().lower().startswith("json"):
            content = "\n".join(lines[1:])
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.exception("Grok returned invalid JSON: %s", e)
        raise ValueError("LLM did not return valid JSON") from e
