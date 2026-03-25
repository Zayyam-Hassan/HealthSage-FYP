"""
Lifestyle agent: calls existing lifestyle service and returns structured output with evidence.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from services.lifestyle.service import generate_and_store_lifestyle_recs

logger = logging.getLogger(__name__)


class LifestyleAgent:
    """Wrapper around lifestyle recommendation engine. Preserves evidence metadata."""

    def run(self, patient_id: str) -> Dict[str, Any]:
        """
        Call lifestyle service; return structured validated output only.
        Format: { "agent": "lifestyle", "data": {...} }
        """
        try:
            result = generate_and_store_lifestyle_recs(patient_id)
        except Exception as e:
            logger.exception("LifestyleAgent failed for patient %s: %s", patient_id, e)
            raise
        return {
            "agent": "lifestyle",
            "data": {
                "patient_id": result.get("patient_id"),
                "context": result.get("context"),
                "guidelines_used": result.get("guidelines_used", []),
                "plan": result.get("plan", {}),
            },
        }
