"""
Format chatbot response into a single clinician-facing message.
Never states that the model is correct or that the clinician must prescribe.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_ITALIC_STAR_RE = re.compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)")
_ITALIC_UNDERSCORE_RE = re.compile(r"(?<!_)_([^_\n]+)_(?!_)")


def _strength_label(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized == "strong":
        return "strong"
    if normalized == "moderate":
        return "moderate"
    return "weak"


def sanitize_chatbot_text(text: Optional[str]) -> str:
    """
    Convert common LLM markdown patterns into plain text so chatbot replies
    render cleanly in simple text UIs and persisted chat history.
    """
    if not text:
        return ""

    cleaned = str(text).replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"```(?:[a-zA-Z0-9_+-]+)?\s*", "", cleaned)
    cleaned = cleaned.replace("```", "")
    cleaned = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r"\1 \2", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", cleaned)
    cleaned = re.sub(r"^\s{0,3}#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s{0,3}>\s?", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*[-*+]\s+", "- ", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*\d+\.\s+", "- ", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"(\*\*|__)(.*?)\1", r"\2", cleaned)
    cleaned = _ITALIC_STAR_RE.sub(r"\1", cleaned)
    cleaned = _ITALIC_UNDERSCORE_RE.sub(r"\1", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def format_chatbot_response(
    mode: str,
    risk_output: Optional[Dict[str, Any]] = None,
    lifestyle_output: Optional[Dict[str, Any]] = None,
    medication_output: Optional[Dict[str, Any]] = None,
    explainability_output: Optional[Dict[str, Any]] = None,
    comparison_output: Optional[Dict[str, Any]] = None,
    whatif_output: Optional[Dict[str, Any]] = None,
    user_query: Optional[str] = None,
) -> str:
    """
    Build a concise, clinician-facing summary of the outputs.
    If user_query is provided, acknowledge it for a conversational reply.
    Always include a clinician-review reminder.
    """
    parts: list[str] = []
    if user_query and user_query.strip():
        parts.append(f"You asked: \"{user_query.strip()[:200]}\" - ")

    if risk_output:
        score = risk_output.get("risk_score")
        label = risk_output.get("risk_label", "")
        expl = (risk_output.get("explanation") or {}).get("risk_explanation", "")
        if score is not None and expl:
            parts.append(
                f"For this patient, the risk assessment indicates {label}-risk (score {score:.2f}), "
                f"with factors such as {expl[:200]}{'...' if len(expl) > 200 else ''}"
            )
        elif score is not None:
            parts.append(f"Risk assessment: {label}-risk (score {score:.2f}).")

    if lifestyle_output:
        data = (lifestyle_output.get("data") if isinstance(lifestyle_output, dict) else {}) or {}
        plan = data.get("plan") or {}
        cats = [k for k in ("diet", "activity", "sleep", "other") if plan.get(k)]
        if cats:
            parts.append(
                f"Lifestyle guidance covers {', '.join(cats)}, based on retrieved diabetes guidance."
            )
        else:
            parts.append("Lifestyle recommendations were generated from evidence-based sources.")

    if medication_output:
        data = (medication_output.get("data") if isinstance(medication_output, dict) else {}) or {}
        primary = (data.get("primary_option") or {}).get("drug_name", "")
        safety = data.get("safety_flags") or {}
        safe = safety.get("safe_primary", True)
        grounded = data.get("grounded_response") or {}
        evidence_strength = _strength_label(
            str(data.get("evidence_strength") or grounded.get("evidence_strength") or "weak")
        )
        grounding_notes = str(data.get("notes") or grounded.get("notes") or "").strip()
        grounded_items = grounded.get("recommendations") or []
        key_warning = ""
        if grounded_items and isinstance(grounded_items[0], dict):
            warnings = grounded_items[0].get("key_warnings") or []
            if warnings:
                key_warning = str(warnings[0]).strip()
        if primary:
            sentence = (
                f"Medication suggestions include {primary} as the primary option, "
                f"with {evidence_strength} grounding from the local diabetes drug knowledge base. "
            )
            sentence += (
                "Graph-based safety checks did not identify major contraindications in the current record."
                if safe
                else "Safety checks flagged items for review."
            )
            if evidence_strength == "weak":
                sentence += " Supporting medication evidence is limited, so this should be treated cautiously."
            if key_warning:
                sentence += f" Key warning: {key_warning[:220]}{'...' if len(key_warning) > 220 else ''}"
            elif grounding_notes:
                sentence += f" Note: {grounding_notes[:220]}{'...' if len(grounding_notes) > 220 else ''}"
            parts.append(sentence)
        else:
            if grounding_notes:
                parts.append(
                    "Medication suggestions are available in the detailed output. "
                    f"Grounding note: {grounding_notes[:220]}{'...' if len(grounding_notes) > 220 else ''}"
                )
            else:
                parts.append("Medication suggestions are available in the detailed output.")

    if comparison_output:
        parts.append(
            "A reflective comparison with the clinician's plan is included; "
            "it does not rank clinician judgment against the model."
        )

    if whatif_output:
        we = whatif_output.get("whatif_explanation") or {}
        if isinstance(we, dict):
            we = we.get("whatif_explanation", "")
        if we:
            parts.append(f"What-if summary: {we[:300]}{'...' if len(str(we)) > 300 else ''}")

    if not parts:
        return sanitize_chatbot_text(
            "No structured output was generated for this request. "
            "All outputs are intended for clinician review and not as autonomous treatment decisions."
        )

    intro = " ".join(parts[:1]) if user_query and user_query.strip() else ""
    rest = " ".join(parts[1:] if user_query and user_query.strip() else parts)
    return sanitize_chatbot_text(
        (intro + rest if intro else rest)
        + " These outputs are intended for clinician review and not as autonomous treatment decisions."
    )
