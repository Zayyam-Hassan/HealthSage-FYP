"""
Medication agent: calls existing medication service and returns structured output with safety flags.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from services.medication.service import generate_patient_medication_recommendation

from .response_formatter import build_detailed_medication_message, build_medication_detail_sections

logger = logging.getLogger(__name__)


class MedicationAgent:
    """Wrapper around medication recommendation engine. Preserves safety flags and evidence."""

    def run(self, patient_id: str) -> Dict[str, Any]:
        """
        Call medication service; return structured validated output with safety.
        Format: { "agent": "medication", "data": {...} }
        """
        try:
            result = generate_patient_medication_recommendation(patient_id)
        except Exception as e:
            logger.exception("MedicationAgent failed for patient %s: %s", patient_id, e)
            raise
        data = {
            "patient_id": result.get("patient_id"),
            "primary_option": result.get("primary_option"),
            "alternatives": result.get("alternatives", []),
            "missing_information": result.get("missing_information", []),
            "doctor_note": result.get("doctor_note"),
            "safety_flags": result.get("safety_flags", {}),
            "recommended_medications": result.get("recommended_medications", []),
            "clinical_reasoning": result.get("clinical_reasoning"),
            "warnings": result.get("warnings", []),
            "confidence_score": result.get("confidence_score"),
            "agent_trace": result.get("agent_trace", []),
            "grounded_response": result.get("grounded_response"),
            "retrieved_evidence": result.get("retrieved_evidence", []),
            "evidence_strength": result.get("evidence_strength"),
            "notes": result.get("notes"),
            "context_summary": result.get("context_summary"),
        }
        wrapped = {"agent": "medication", "data": data}
        return {
            "agent": "medication",
            "data": {
                **data,
                "detailed_response": build_medication_detail_sections(wrapped),
                "detailed_message": build_detailed_medication_message(wrapped),
            },
        }
