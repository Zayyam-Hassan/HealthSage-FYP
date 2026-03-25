"""
Format chatbot responses for clinician-facing chat.
Detailed medication and lifestyle guidance should remain rich and readable,
while non-care flows can stay concise.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Optional

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
    Normalize markdown-like artifacts while preserving readable sectioned text.
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


def _coerce_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _dedupe_preserve_order(items: Iterable[str]) -> List[str]:
    seen: set[str] = set()
    output: List[str] = []
    for item in items:
        normalized = _coerce_text(item)
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        output.append(normalized)
    return output


def _extract_text_list(items: Any) -> List[str]:
    if not items:
        return []
    output: List[str] = []
    for item in items:
        if isinstance(item, dict):
            text = item.get("text") or item.get("content") or item.get("recommendation") or item.get("reason")
            if text:
                output.append(_coerce_text(text))
        else:
            output.append(_coerce_text(item))
    return _dedupe_preserve_order(output)


def _format_section(title: str, lines: Iterable[str]) -> str:
    values = _dedupe_preserve_order(lines)
    if not values:
        return ""
    body = "\n".join(f"- {line}" for line in values)
    return f"{title}:\n{body}"


def _metric_line(label: str, value: Any, suffix: str = "") -> str:
    text = _coerce_text(value)
    if not text:
        return ""
    return f"{label}: {text}{suffix}"


def _build_lifestyle_context_lines(context: Dict[str, Any]) -> List[str]:
    return _dedupe_preserve_order(
        [
            _metric_line("HbA1c", context.get("HbA1c")),
            _metric_line("Glucose", context.get("glucose")),
            _metric_line("BMI", context.get("BMI")),
            _metric_line(
                "Blood pressure",
                " / ".join(
                    value
                    for value in [
                        _coerce_text(context.get("systolic_bp")),
                        _coerce_text(context.get("diastolic_bp")),
                    ]
                    if value
                ),
            ),
            _metric_line("Age", context.get("age")),
            _metric_line("Smoker", "yes" if context.get("smoker") else "no"),
            _metric_line("Activity level", context.get("activity_level")),
        ]
    )


def _build_lifestyle_rationale_lines(context: Dict[str, Any], guidelines_used: List[Dict[str, Any]]) -> List[str]:
    lines: List[str] = []
    hba1c = context.get("HbA1c")
    bmi = context.get("BMI")
    systolic_bp = context.get("systolic_bp")
    smoker = context.get("smoker")

    try:
        if hba1c is not None and float(hba1c) >= 7:
            lines.append("Glycemic control appears above target, so diet and activity counseling should be reinforced.")
    except Exception:
        pass
    try:
        if bmi is not None and float(bmi) >= 25:
            lines.append("Weight-sensitive nutrition and activity planning is relevant in this patient context.")
    except Exception:
        pass
    try:
        if systolic_bp is not None and float(systolic_bp) >= 130:
            lines.append("Blood-pressure-aware lifestyle measures should be part of follow-up planning.")
    except Exception:
        pass
    if smoker:
        lines.append("Smoking status increases the importance of cessation counseling and routine support.")

    sources = _dedupe_preserve_order(
        f"{item.get('source')}: {item.get('reference')}"
        for item in (guidelines_used or [])[:3]
        if item.get("source") or item.get("reference")
    )
    if sources:
        lines.append(f"Guidance is grounded in sources such as {'; '.join(sources)}")

    if not lines:
        lines.append("The plan is tailored to the available metabolic and cardiovascular context plus retrieved diabetes lifestyle guidance.")
    return _dedupe_preserve_order(lines)


def build_lifestyle_detail_sections(lifestyle_output: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    data = (lifestyle_output or {}).get("data") if isinstance(lifestyle_output, dict) else {}
    data = data or {}
    context = data.get("context") or {}
    plan = data.get("plan") or {}
    guidelines_used = data.get("guidelines_used") or []

    diet_lines = _extract_text_list(plan.get("diet"))
    activity_lines = _extract_text_list(plan.get("activity"))
    sleep_lines = _extract_text_list(plan.get("sleep"))
    other_lines = _extract_text_list(plan.get("other"))

    monitoring_lines = _dedupe_preserve_order(
        [
            "Follow-up should review adherence to the nutrition, activity, sleep, and routine plan.",
            "Reassess glycemic trends, weight trajectory, blood pressure, and symptoms after lifestyle changes are implemented.",
            "Escalate review sooner if fatigue, hypoglycemia concerns, exertional symptoms, or sleep-disorder symptoms become limiting.",
        ]
    )
    caution_lines = _dedupe_preserve_order(
        [
            "Exercise advice should be individualized to comorbidities, mobility, cardiovascular symptoms, and current conditioning.",
            "Lifestyle recommendations are based on available charted context and may need adjustment if diet history, functional status, or psychosocial barriers are incomplete.",
        ]
    )

    return {
        "patient_context": _build_lifestyle_context_lines(context),
        "why_recommended": _build_lifestyle_rationale_lines(context, guidelines_used),
        "diet_guidance": diet_lines,
        "physical_activity_guidance": activity_lines,
        "sleep_guidance": sleep_lines,
        "stress_routine_guidance": other_lines,
        "monitoring_follow_up": monitoring_lines,
        "cautions_limitations": caution_lines,
        "clinician_review_note": "Lifestyle guidance should be aligned with the clinician's assessment, patient preferences, and comorbidities.",
    }


def build_detailed_lifestyle_message(lifestyle_output: Optional[Dict[str, Any]]) -> str:
    sections = build_lifestyle_detail_sections(lifestyle_output)
    blocks = [
        _format_section("Lifestyle guidance for this patient", sections.get("patient_context", [])),
        _format_section("Why these lifestyle measures are being recommended", sections.get("why_recommended", [])),
        _format_section("Diet guidance", sections.get("diet_guidance", [])),
        _format_section("Physical activity guidance", sections.get("physical_activity_guidance", [])),
        _format_section("Sleep guidance", sections.get("sleep_guidance", [])),
        _format_section("Stress and routine guidance", sections.get("stress_routine_guidance", [])),
        _format_section("Monitoring and follow-up", sections.get("monitoring_follow_up", [])),
        _format_section("Important cautions or limitations", sections.get("cautions_limitations", [])),
        _format_section("Clinician review", [sections.get("clinician_review_note", "")]),
    ]
    return sanitize_chatbot_text("\n\n".join(block for block in blocks if block))


def build_medication_detail_sections(medication_output: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    data = (medication_output or {}).get("data") if isinstance(medication_output, dict) else {}
    data = data or {}
    grounded = data.get("grounded_response") or {}
    primary = data.get("primary_option") or {}
    grounded_recs = grounded.get("recommendations") or []
    first_grounded = grounded_recs[0] if grounded_recs and isinstance(grounded_recs[0], dict) else {}
    evidence_strength = _strength_label(str(data.get("evidence_strength") or grounded.get("evidence_strength") or "weak"))
    safety_flags = data.get("safety_flags") or {}

    drug_evidence = first_grounded.get("drug_evidence") or []
    guideline_support = first_grounded.get("guideline_support") or []
    supporting_evidence = first_grounded.get("supporting_evidence") or []
    key_warnings = _dedupe_preserve_order(
        list(first_grounded.get("key_warnings") or [])
        + list(grounded.get("general_warnings") or [])
        + list(data.get("warnings") or [])
        + list(safety_flags.get("primary_flags") or [])
    )
    key_interactions = _dedupe_preserve_order(first_grounded.get("key_interactions") or [])

    drug_evidence_lines = _dedupe_preserve_order(
        f"{item.get('drug_name') or primary.get('drug_name') or primary.get('name')}: {item.get('content')} ({item.get('source') or item.get('source_url')})"
        for item in (drug_evidence or supporting_evidence)[:4]
        if item.get("content")
    )
    guideline_lines = _dedupe_preserve_order(
        f"{item.get('content')} ({item.get('source') or item.get('source_url')})"
        for item in guideline_support[:4]
        if item.get("content")
    )

    alternatives = data.get("alternatives") or []
    alternative_flags = safety_flags.get("alternative_flags") or []
    alternative_flag_map = {
        _coerce_text(item.get("drug_name")): _dedupe_preserve_order(item.get("flags") or [])
        for item in alternative_flags
        if isinstance(item, dict)
    }
    excluded_or_deprioritized: List[str] = []
    for alt in alternatives:
        alt_name = _coerce_text(alt.get("drug_name") or alt.get("name"))
        alt_reason = "; ".join(_dedupe_preserve_order((alt.get("why") or [])))
        alt_flags = alternative_flag_map.get(alt_name) or []
        line = alt_name
        if alt_reason:
            line += f" remained an alternative because {alt_reason}"
        else:
            line += " remained below the primary option in the current recommendation set"
        if alt_flags:
            line += f"; review flags: {', '.join(alt_flags)}"
        excluded_or_deprioritized.append(line)

    caution_lines = _dedupe_preserve_order(
        list(data.get("missing_information") or [])
        + [data.get("notes") or grounded.get("notes") or ""]
        + [
            "Primary option has review flags and should not be accepted without clinician review."
            if safety_flags.get("safe_primary") is False
            else ""
        ]
        + [
            "Evidence strength is weak, so medication selection should be treated cautiously."
            if evidence_strength == "weak"
            else ""
        ]
    )

    context_lines = _dedupe_preserve_order(
        [
            _coerce_text(data.get("context_summary")),
            _coerce_text(data.get("clinical_reasoning")),
            (
                f"Primary option under consideration: {primary.get('drug_name') or primary.get('name')}"
                if (primary.get("drug_name") or primary.get("name"))
                else ""
            ),
            f"Evidence strength: {evidence_strength}",
        ]
    )

    why_match_lines = _dedupe_preserve_order(
        [
            _coerce_text(first_grounded.get("why_it_matches_patient")),
            _coerce_text(first_grounded.get("why_it_matches")),
        ]
    )

    return {
        "patient_context": context_lines,
        "why_medication_matches": why_match_lines,
        "supporting_drug_evidence": drug_evidence_lines,
        "supporting_guideline_evidence": guideline_lines,
        "key_warnings": key_warnings,
        "interaction_notes": key_interactions,
        "contraindications_cautions": caution_lines,
        "excluded_or_deprioritized_options": excluded_or_deprioritized,
        "next_step_note": data.get("doctor_note") or grounded.get("disclaimer") or "Medication decisions must always be confirmed by the clinician.",
    }


def build_detailed_medication_message(medication_output: Optional[Dict[str, Any]]) -> str:
    sections = build_medication_detail_sections(medication_output)
    blocks = [
        _format_section("Medication guidance for this patient", sections.get("patient_context", [])),
        _format_section("Why the leading option fits this patient", sections.get("why_medication_matches", [])),
        _format_section("Supporting drug evidence", sections.get("supporting_drug_evidence", [])),
        _format_section("Supporting guideline evidence", sections.get("supporting_guideline_evidence", [])),
        _format_section("Key warnings", sections.get("key_warnings", [])),
        _format_section("Interaction notes", sections.get("interaction_notes", [])),
        _format_section("Contraindication or caution notes", sections.get("contraindications_cautions", [])),
        _format_section("Options not selected as primary", sections.get("excluded_or_deprioritized_options", [])),
        _format_section("Next step", [sections.get("next_step_note", "")]),
    ]
    return sanitize_chatbot_text("\n\n".join(block for block in blocks if block))


def _build_summary_response(
    mode: str,
    risk_output: Optional[Dict[str, Any]] = None,
    lifestyle_output: Optional[Dict[str, Any]] = None,
    medication_output: Optional[Dict[str, Any]] = None,
    explainability_output: Optional[Dict[str, Any]] = None,
    comparison_output: Optional[Dict[str, Any]] = None,
    whatif_output: Optional[Dict[str, Any]] = None,
    user_query: Optional[str] = None,
) -> str:
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


def format_chatbot_summary(
    mode: str,
    risk_output: Optional[Dict[str, Any]] = None,
    lifestyle_output: Optional[Dict[str, Any]] = None,
    medication_output: Optional[Dict[str, Any]] = None,
    explainability_output: Optional[Dict[str, Any]] = None,
    comparison_output: Optional[Dict[str, Any]] = None,
    whatif_output: Optional[Dict[str, Any]] = None,
    user_query: Optional[str] = None,
) -> str:
    return _build_summary_response(
        mode=mode,
        risk_output=risk_output,
        lifestyle_output=lifestyle_output,
        medication_output=medication_output,
        explainability_output=explainability_output,
        comparison_output=comparison_output,
        whatif_output=whatif_output,
        user_query=user_query,
    )


def build_chatbot_detail_bundle(
    mode: str,
    risk_output: Optional[Dict[str, Any]] = None,
    lifestyle_output: Optional[Dict[str, Any]] = None,
    medication_output: Optional[Dict[str, Any]] = None,
    explainability_output: Optional[Dict[str, Any]] = None,
    comparison_output: Optional[Dict[str, Any]] = None,
    whatif_output: Optional[Dict[str, Any]] = None,
    user_query: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    summary_message = format_chatbot_summary(
        mode=mode,
        risk_output=risk_output,
        lifestyle_output=lifestyle_output,
        medication_output=medication_output,
        explainability_output=explainability_output,
        comparison_output=comparison_output,
        whatif_output=whatif_output,
        user_query=user_query,
    )

    if not lifestyle_output and not medication_output:
        return {
            "final_message": summary_message,
            "summary_message": summary_message,
            "detailed_message": None,
        }

    sections: List[str] = []
    if user_query and user_query.strip():
        sections.append(_format_section("Clinician question", [user_query.strip()]))

    if risk_output:
        risk_lines = _dedupe_preserve_order(
            [
                (
                    f"Risk estimate: {risk_output.get('risk_label', 'unknown')} "
                    f"(score {risk_output.get('risk_score'):.2f})"
                    if risk_output.get("risk_score") is not None
                    else ""
                ),
                _coerce_text((risk_output.get("explanation") or {}).get("risk_explanation")),
            ]
        )
        sections.append(_format_section("Overall clinical context", risk_lines))

    if lifestyle_output:
        sections.append(build_detailed_lifestyle_message(lifestyle_output))

    if medication_output:
        sections.append(build_detailed_medication_message(medication_output))

    if comparison_output:
        sections.append(
            _format_section(
                "Comparison note",
                ["A structured comparison with the clinician's plan is available in the comparison output for review."],
            )
        )

    if whatif_output:
        we = whatif_output.get("whatif_explanation") or {}
        if isinstance(we, dict):
            we = we.get("whatif_explanation", "")
        sections.append(_format_section("What-if note", [_coerce_text(we)]))

    sections.append(
        _format_section(
            "Clinician review",
            ["These outputs are decision-support only and should be reviewed by the clinician before care changes are made."],
        )
    )
    detailed_message = sanitize_chatbot_text("\n\n".join(block for block in sections if block))
    return {
        "final_message": detailed_message,
        "summary_message": summary_message,
        "detailed_message": detailed_message,
    }


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
    return build_chatbot_detail_bundle(
        mode=mode,
        risk_output=risk_output,
        lifestyle_output=lifestyle_output,
        medication_output=medication_output,
        explainability_output=explainability_output,
        comparison_output=comparison_output,
        whatif_output=whatif_output,
        user_query=user_query,
    )["final_message"] or ""
