"""
What-if agent: run the real scenario comparison service for chatbot requests.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from services.what_if_analysis import compare_patient_scenario, extract_what_if_changes

logger = logging.getLogger(__name__)


class WhatIfAgent:
    """
    Run model-grounded what-if analysis from explicit changes or free-text clinician prompts.
    """

    def run(
        self,
        patient_id: str,
        what_if_changes: Dict[str, Any] | None = None,
        doctor_query: str | None = None,
    ) -> Dict[str, Any]:
        changes = dict(what_if_changes or {})
        if not changes:
            changes = extract_what_if_changes(doctor_query)

        if not changes:
            return {
                "changes": {},
                "comparison": None,
                "whatif_explanation": {
                    "whatif_explanation": (
                        "The risk-simulation tool did not produce a comparison because no valid changes "
                        "were specified in the input."
                    ),
                    "input_changes": [],
                    "risk_change": "",
                    "medication_change": "",
                    "safety_change": "",
                },
            }

        try:
            comparison = compare_patient_scenario(patient_id, changes)
        except Exception as e:
            logger.exception("What-if comparison failed: %s", e)
            return {
                "changes": changes,
                "comparison": None,
                "whatif_explanation": {
                    "whatif_explanation": f"What-if analysis could not be completed: {e}",
                    "input_changes": [f"{k}: {v}" for k, v in changes.items()],
                    "risk_change": "",
                    "medication_change": "",
                    "safety_change": "",
                },
            }

        baseline = comparison.get("baseline") or {}
        scenario = comparison.get("scenario") or {}
        delta = comparison.get("risk_delta") or {}
        formatted_changes = comparison.get("changes") or []
        risk_change = (
            f"Risk score: {baseline.get('risk_score', 0):.3f} -> "
            f"{scenario.get('risk_score', 0):.3f}."
        )
        explanation = (
            f"{comparison.get('analysis', {}).get('summary', '')} "
            f"Changed features: "
            f"{'; '.join(f'{item.get('label')}: {item.get('baseline_value')} -> {item.get('scenario_value')}' for item in formatted_changes[:6])}. "
            f"Risk delta: {delta.get('absolute', 0)} ({delta.get('relative_percent', 0)}% {delta.get('direction', 'no_change')})."
        ).strip()

        return {
            "changes": changes,
            "comparison": comparison,
            "whatif_explanation": {
                "whatif_explanation": explanation,
                "input_changes": [
                    f"{item.get('label')}: {item.get('baseline_value')} -> {item.get('scenario_value')}"
                    for item in formatted_changes
                ],
                "risk_change": risk_change,
                "medication_change": "Medication recommendations are not changed automatically by this simulation.",
                "safety_change": "Safety review still requires clinician judgement.",
            },
        }
