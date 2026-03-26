from __future__ import annotations

import logging
from typing import Any, Dict

from services.doctor_treatment_plan_service import (
    build_doctor_treatment_message,
    build_doctor_treatment_summary,
    get_active_doctor_treatment_plan,
)

logger = logging.getLogger(__name__)


class DoctorTreatmentAgent:
    """Fetch the stored doctor-authored treatment plan for chatbot use."""

    def run(self, patient_id: str) -> Dict[str, Any]:
        try:
            plan = get_active_doctor_treatment_plan(patient_id)
        except Exception as e:
            logger.exception("DoctorTreatmentAgent failed for patient %s: %s", patient_id, e)
            return {
                "agent": "doctor_treatment",
                "data": None,
                "formatted": {
                    "summary": f"Doctor treatment plan could not be loaded: {e}",
                    "message": (
                        "The stored doctor-authored treatment plan could not be loaded right now. "
                        "Please retry or review the dashboard record directly."
                    ),
                },
            }

        return {
            "agent": "doctor_treatment",
            "data": plan,
            "formatted": {
                **build_doctor_treatment_summary(plan),
                "message": build_doctor_treatment_message(plan),
            },
        }
