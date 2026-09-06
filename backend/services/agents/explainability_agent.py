"""
Explainability agent: unified risk, lifestyle, medication, safety, and what-if explanations.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.schemas.explainability import EvidenceSummaryItem, ExplainabilityPayload
from services.risk.risk_service import get_risk_with_explanation

logger = logging.getLogger(__name__)


class ExplainabilityAgent:
    """Builds clinician-facing explanation payloads from risk, lifestyle, medication, and safety outputs."""

    def explain_risk(self, patient_id: str) -> Dict[str, Any]:
        """Call risk service and return structured risk explanation."""
        try:
            out = get_risk_with_explanation(patient_id)
            expl = out.get("explanation") or {}
            return {
                "risk_explanation": expl.get("risk_explanation", ""),
                "top_features": expl.get("top_features", []),
                "graph_context_summary": expl.get("graph_context_summary", ""),
                "method": expl.get("method", "feature_importance"),
            }
        except Exception as e:
            logger.exception("explain_risk failed: %s", e)
            return {
                "risk_explanation": "Risk explanation could not be generated.",
                "top_features": [],
                "graph_context_summary": "",
                "method": "error",
            }

    def explain_recommendations(
        self,
        patient_id: str,
        risk_output: Optional[Dict[str, Any]] = None,
        lifestyle_output: Optional[Dict[str, Any]] = None,
        medication_output: Optional[Dict[str, Any]] = None,
    ) -> ExplainabilityPayload:
        """
        Combine GraphSAGE explanation, lifestyle reasons/evidence, medication reasons/evidence,
        and Neo4j safety flags into a unified explanation payload.
        """
        evidence_summary: List[EvidenceSummaryItem] = []

        risk_explanation = ""
        if risk_output:
            expl = risk_output.get("explanation") or {}
            risk_explanation = expl.get("risk_explanation") or ""
            top = expl.get("top_features") or []
            if top:
                names = [f.get("name") for f in top[:5] if f.get("name")]
                evidence_summary.append(
                    EvidenceSummaryItem(
                        source_type="model",
                        title="GraphSAGE risk prediction",
                        detail=f"Top features: {', '.join(names)}.",
                    )
                )

        lifestyle_explanation = ""
        if lifestyle_output:
            data = lifestyle_output.get("data") if isinstance(lifestyle_output, dict) else {}
            guidelines = data.get("guidelines_used") or []
            plan = data.get("plan") or {}
            lifestyle_explanation = (
                "Lifestyle guidance is based on retrieved evidence and current patient context. "
                f"Guidelines used: {len(guidelines)}. Categories: diet, activity, sleep, behavioral."
            )
            if guidelines:
                evidence_summary.append(
                    EvidenceSummaryItem(
                        source_type="web",
                        title="Diabetes lifestyle evidence",
                        detail="Serper-retrieved ADA and trusted source excerpts used for recommendations.",
                    )
                )

        medication_explanation = ""
        safety_explanation = ""
        if medication_output:
            data = medication_output.get("data") if isinstance(medication_output, dict) else {}
            primary = data.get("primary_option") or {}
            medication_explanation = (
                f"Primary suggestion: {primary.get('drug_name', 'N/A')} ({primary.get('drug_class', '')}). "
                "Reasoning and evidence sources are included in the medication output. "
                "Suggestions are for clinician consideration only."
            )
            safety = data.get("safety_flags") or {}
            safe_primary = safety.get("safe_primary", True)
            flags = safety.get("primary_flags") or []
            if safe_primary and not flags:
                safety_explanation = "No major contraindication or interaction was identified in graph-based safety checks. Alternatives may still require clinician review."
            elif flags:
                safety_explanation = f"Safety check noted: {'; '.join(flags[:3])}. Flagged for review."
            else:
                safety_explanation = "Graph-based safety checks were run; see safety_flags in medication output for detail."
            evidence_summary.append(
                EvidenceSummaryItem(
                    source_type="graph",
                    title="Neo4j safety filter",
                    detail="Checked drug-drug interactions and contraindications where graph is configured.",
                )
            )

        return ExplainabilityPayload(
            risk_explanation=risk_explanation,
            lifestyle_explanation=lifestyle_explanation,
            medication_explanation=medication_explanation,
            safety_explanation=safety_explanation,
            whatif_explanation=None,
            evidence_summary=evidence_summary,
            doctor_note="These outputs are decision-support suggestions and require clinician review.",
        )

    def explain_whatif(
        self,
        original_context: Dict[str, Any],
        modified_context: Dict[str, Any],
        original_outputs: Dict[str, Any],
        modified_outputs: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Describe what changed in inputs and how risk/lifestyle/medication outputs changed.
        """
        changes: List[str] = []
        for key in set(original_context) | set(modified_context):
            if key in ("patient_id", "snapshot_at"):
                continue
            ov = original_context.get(key)
            mv = modified_context.get(key)
            if ov != mv:
                changes.append(f"{key}: {ov} → {mv}")

        risk_orig = (original_outputs.get("risk") or {}).get("risk_score")
        risk_mod = (modified_outputs.get("risk") or {}).get("risk_score")
        risk_change = ""
        if risk_orig is not None and risk_mod is not None:
            risk_change = f"Risk score: {risk_orig:.3f} → {risk_mod:.3f}."

        primary_orig = (original_outputs.get("medication") or {}).get("data") or {}
        primary_orig = (primary_orig.get("primary_option") or {}).get("drug_name")
        primary_mod = (modified_outputs.get("medication") or {}).get("data") or {}
        primary_mod = (primary_mod.get("primary_option") or {}).get("drug_name")
        med_change = ""
        if primary_orig != primary_mod:
            med_change = f"Primary medication suggestion: {primary_orig or 'N/A'} → {primary_mod or 'N/A'}."
        else:
            med_change = "Primary medication suggestion unchanged."

        safety_orig = (original_outputs.get("medication") or {}).get("data") or {}
        safety_orig = (safety_orig.get("safety_flags") or {}).get("safe_primary", True)
        safety_mod = (modified_outputs.get("medication") or {}).get("data") or {}
        safety_mod = (safety_mod.get("safety_flags") or {}).get("safe_primary", True)
        safety_change = "Safety status unchanged." if safety_orig == safety_mod else "Safety status changed; review flags."

        whatif_explanation = (
            f"Inputs changed: {', '.join(changes[:10])}. "
            f"{risk_change} "
            f"Lifestyle plan may differ based on modified context. "
            f"{med_change} "
            f"{safety_change}"
        )
        return {
            "whatif_explanation": whatif_explanation,
            "input_changes": changes,
            "risk_change": risk_change,
            "medication_change": med_change,
            "safety_change": safety_change,
        }
