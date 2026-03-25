"""
What-if agent: run risk/lifestyle/medication with a temporary modified context (no overwrite of patient record).
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from services.agents.explainability_agent import ExplainabilityAgent
from services.medication.context_builder import build_medication_context

logger = logging.getLogger(__name__)


class WhatIfAgent:
    """
    Run pipelines with modified context for what-if scenarios.
    Does not persist modified context to the patient record.
    """

    def __init__(self) -> None:
        self._explainability = ExplainabilityAgent()

    def run(self, patient_id: str, what_if_changes: Dict[str, Any]) -> Dict[str, Any]:
        """
        Load original context, build modified context (in-memory only), run risk/lifestyle/medication
        on both where possible, then explain differences.
        Note: Risk and lifestyle/medication services currently read from MongoDB only; we run
        with original context for "original_outputs" and with modified context only where
        the underlying service accepts an override. For a full what-if, the services would
        need to accept optional context override. Here we run original pipeline once and
        simulate modified by re-calling with a temporary context build (medication context
        can be overridden in memory for Grok; risk would need feature override).
        """
        if not what_if_changes:
            return {
                "original_context": {},
                "modified_context": {},
                "original_outputs": {},
                "modified_outputs": {},
                "whatif_explanation": {"whatif_explanation": "No changes specified."},
            }

        # Load original context (from DB)
        try:
            original_context = build_medication_context(patient_id)
        except Exception as e:
            logger.exception("WhatIf: could not build original context: %s", e)
            return {
                "original_context": {},
                "modified_context": {},
                "original_outputs": {},
                "modified_outputs": {},
                "whatif_explanation": {"whatif_explanation": f"Could not load context: {e}."},
            }

        modified_context = dict(original_context)
        for key, value in what_if_changes.items():
            if key in modified_context:
                modified_context[key] = value

        # Run original pipeline (risk + lifestyle + medication from DB)
        from services.risk.risk_service import get_risk_with_explanation
        from services.agents.lifestyle_agent import LifestyleAgent
        from services.agents.medication_agent import MedicationAgent

        original_risk = {}
        original_lifestyle = {}
        original_medication = {}
        try:
            original_risk = get_risk_with_explanation(patient_id)
        except Exception as e:
            logger.warning("WhatIf original risk failed: %s", e)
        try:
            original_lifestyle = LifestyleAgent().run(patient_id)
        except Exception as e:
            logger.warning("WhatIf original lifestyle failed: %s", e)
        try:
            original_medication = MedicationAgent().run(patient_id)
        except Exception as e:
            logger.warning("WhatIf original medication failed: %s", e)

        original_outputs = {
            "risk": original_risk,
            "lifestyle": original_lifestyle,
            "medication": original_medication,
        }

        # Modified pipeline: we cannot easily run GraphSAGE with modified features without
        # a dedicated API that accepts feature dict. So we run lifestyle and medication
        # with modified_context by calling the internal builders and Grok with that context.
        # For a minimal implementation we return original_outputs for both and add a note.
        # A fuller implementation would: build features from modified_context, run risk;
        # call lifestyle/medication with context override.
        modified_outputs: Dict[str, Any] = {
            "risk": original_risk,  # TODO: run risk with modified features when API supports
            "lifestyle": original_lifestyle,  # TODO: run lifestyle with modified context
            "medication": original_medication,  # TODO: run medication with modified context
        }

        # If we have a medication service that accepts context override we could call it here.
        # For now, run medication with modified context via a one-off path if available.
        try:
            from services.medication.serper_retriever import retrieve_medication_guidance, compress_medical_evidence
            from services.medication.grok_engine import generate_medication_plan
            from services.medication.validator import validate_medication_output
            from services.medication.safety_filter import check_medication_safety
            from services.medication.context_builder import build_tailoring_summary
            serper_results = retrieve_medication_guidance(modified_context, top_k=5)
            evidence_block = compress_medical_evidence(serper_results)
            tailoring = build_tailoring_summary(modified_context)
            llm_raw = generate_medication_plan(modified_context, evidence_block, tailoring)
            validated = validate_medication_output(llm_raw)
            safety = check_medication_safety(modified_context, llm_raw)
            modified_outputs["medication"] = {
                "agent": "medication",
                "data": {
                    "primary_option": validated.primary_option.model_dump(),
                    "alternatives": [a.model_dump() for a in validated.alternatives],
                    "missing_information": validated.missing_information,
                    "doctor_note": validated.doctor_note,
                    "safety_flags": safety,
                },
            }
        except Exception as e:
            logger.warning("WhatIf modified medication failed: %s", e)

        whatif_explanation = self._explainability.explain_whatif(
            original_context,
            modified_context,
            original_outputs,
            modified_outputs,
        )

        return {
            "original_context": original_context,
            "modified_context": modified_context,
            "original_outputs": original_outputs,
            "modified_outputs": modified_outputs,
            "whatif_explanation": whatif_explanation,
        }
