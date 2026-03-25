"""
Coordinator agent: routes clinician requests to specialized agents and merges outputs.
Does not perform raw medical reasoning; only orchestrates services.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

from app.schemas.chatbot import ChatbotRequest, ChatbotResponse
from app.schemas.explainability import ExplainabilityPayload

from .doctor_comparison import compute_doctor_vs_model_diff
from .explainability_agent import ExplainabilityAgent
from .lifestyle_agent import LifestyleAgent
from .medication_agent import MedicationAgent
from .response_formatter import build_chatbot_detail_bundle
from .whatif_agent import WhatIfAgent

logger = logging.getLogger(__name__)


def _infer_mode_from_query(doctor_query: str) -> str:
    """Infer intent from free-text for 'auto' mode. Returns recommend | explain | what_if | compare."""
    if not doctor_query or not isinstance(doctor_query, str):
        return "recommend"
    q = doctor_query.strip().lower()
    if "what if" in q or "what-if" in q or "whatif" in q or "hypothetical" in q or "suppose" in q:
        return "what_if"
    if "explain" in q or "why " in q or "reason" in q or "factor" in q:
        return "explain"
    if "compare" in q or "my plan" in q or "vs " in q or "versus" in q or "against" in q:
        return "compare"
    return "recommend"


class CoordinatorAgent:
    """Orchestrates risk, lifestyle, medication, explainability, what-if, and comparison."""

    def __init__(self) -> None:
        self._lifestyle = LifestyleAgent()
        self._medication = MedicationAgent()
        self._explainability = ExplainabilityAgent()
        self._whatif = WhatIfAgent()

    def handle_request(self, payload: ChatbotRequest) -> ChatbotResponse:
        """
        Route by mode: recommend | explain | what_if | compare | auto.
        Returns structured ChatbotResponse with agent_outputs and final_message.
        """
        raw_mode = (payload.mode or "recommend").strip().lower()
        mode = _infer_mode_from_query(payload.doctor_query) if raw_mode == "auto" else raw_mode
        patient_id = payload.patient_id

        risk_output: Dict[str, Any] = {}
        lifestyle_output: Dict[str, Any] = {}
        medication_output: Dict[str, Any] = {}
        explainability_output: Dict[str, Any] = {}
        comparison_output: Dict[str, Any] = {}
        whatif_output: Dict[str, Any] = {}

        if mode == "what_if":
            what_if_changes = payload.what_if_changes or {}
            whatif_output = self._whatif.run(patient_id, what_if_changes)
            expl = whatif_output.get("whatif_explanation") or {}
            explainability_output = {
                "whatif_explanation": expl.get("whatif_explanation"),
                "input_changes": expl.get("input_changes", []),
                "risk_change": expl.get("risk_change"),
                "medication_change": expl.get("medication_change"),
                "safety_change": expl.get("safety_change"),
            }
            message_bundle = build_chatbot_detail_bundle(
                mode=mode,
                whatif_output=whatif_output,
                risk_output=whatif_output.get("original_outputs", {}).get("risk"),
                lifestyle_output=whatif_output.get("original_outputs", {}).get("lifestyle"),
                medication_output=whatif_output.get("original_outputs", {}).get("medication"),
                explainability_output=explainability_output,
                user_query=payload.doctor_query,
            )
            return ChatbotResponse(
                mode=mode,
                patient_id=patient_id,
                agent_outputs={
                    "risk": whatif_output.get("original_outputs", {}).get("risk"),
                    "lifestyle": whatif_output.get("original_outputs", {}).get("lifestyle"),
                    "medication": whatif_output.get("original_outputs", {}).get("medication"),
                    "explainability": explainability_output,
                    "whatif": whatif_output,
                },
                final_message=message_bundle["final_message"] or "",
                detailed_message=message_bundle.get("detailed_message"),
                summary_message=message_bundle.get("summary_message"),
                doctor_note="The doctor remains the final decision-maker.",
            )

        # Risk (for recommend, explain, compare)
        try:
            from services.risk.risk_service import get_risk_with_explanation
            risk_output = get_risk_with_explanation(patient_id)
        except Exception as e:
            logger.warning("Coordinator: risk failed: %s", e)

        if mode == "explain":
            expl_risk = self._explainability.explain_risk(patient_id)
            explainability_output = {
                "risk_explanation": expl_risk.get("risk_explanation"),
                "top_features": expl_risk.get("top_features"),
                "graph_context_summary": expl_risk.get("graph_context_summary"),
                "method": expl_risk.get("method"),
            }
            # Optionally load latest lifestyle/medication if stored
            try:
                lifestyle_output = self._lifestyle.run(patient_id)
                medication_output = self._medication.run(patient_id)
                exp_payload = self._explainability.explain_recommendations(
                    patient_id, risk_output, lifestyle_output, medication_output
                )
                explainability_output = exp_payload.model_dump() if isinstance(exp_payload, ExplainabilityPayload) else exp_payload
            except Exception as e:
                logger.warning("Coordinator explain: lifestyle/medication failed: %s", e)
            message_bundle = build_chatbot_detail_bundle(
                mode=mode,
                risk_output=risk_output,
                lifestyle_output=lifestyle_output,
                medication_output=medication_output,
                explainability_output=explainability_output,
                user_query=payload.doctor_query,
            )
            return ChatbotResponse(
                mode=mode,
                patient_id=patient_id,
                agent_outputs={
                    "risk": risk_output,
                    "lifestyle": lifestyle_output,
                    "medication": medication_output,
                    "explainability": explainability_output,
                },
                final_message=message_bundle["final_message"] or "",
                detailed_message=message_bundle.get("detailed_message"),
                summary_message=message_bundle.get("summary_message"),
                doctor_note="The doctor remains the final decision-maker.",
            )

        if mode == "compare":
            lifestyle_output = self._lifestyle.run(patient_id)
            medication_output = self._medication.run(patient_id)
            doctor_assessment = (
                payload.doctor_assessment.model_dump()
                if payload.doctor_assessment is not None and hasattr(payload.doctor_assessment, "model_dump")
                else (payload.doctor_assessment if isinstance(payload.doctor_assessment, dict) else {})
            )
            model_outputs = {"risk": risk_output, "lifestyle": lifestyle_output, "medication": medication_output}
            comparison_output = compute_doctor_vs_model_diff(doctor_assessment, model_outputs)
            explainability_payload = self._explainability.explain_recommendations(
                patient_id, risk_output, lifestyle_output, medication_output
            )
            explainability_output = explainability_payload.model_dump() if hasattr(explainability_payload, "model_dump") else explainability_payload
            message_bundle = build_chatbot_detail_bundle(
                mode=mode,
                risk_output=risk_output,
                lifestyle_output=lifestyle_output,
                medication_output=medication_output,
                explainability_output=explainability_output,
                comparison_output=comparison_output,
                user_query=payload.doctor_query,
            )
            return ChatbotResponse(
                mode=mode,
                patient_id=patient_id,
                agent_outputs={
                    "risk": risk_output,
                    "lifestyle": lifestyle_output,
                    "medication": medication_output,
                    "explainability": explainability_output,
                    "comparison": comparison_output,
                },
                final_message=message_bundle["final_message"] or "",
                detailed_message=message_bundle.get("detailed_message"),
                summary_message=message_bundle.get("summary_message"),
                doctor_note="The doctor remains the final decision-maker.",
            )

        # recommend (default)
        lifestyle_output = self._lifestyle.run(patient_id)
        medication_output = self._medication.run(patient_id)
        explainability_payload = self._explainability.explain_recommendations(
            patient_id, risk_output, lifestyle_output, medication_output
        )
        explainability_output = explainability_payload.model_dump() if hasattr(explainability_payload, "model_dump") else explainability_payload
        message_bundle = build_chatbot_detail_bundle(
            mode="recommend",
            risk_output=risk_output,
            lifestyle_output=lifestyle_output,
            medication_output=medication_output,
            explainability_output=explainability_output,
            user_query=payload.doctor_query,
        )
        return ChatbotResponse(
            mode="recommend",
            patient_id=patient_id,
            agent_outputs={
                "risk": risk_output,
                "lifestyle": lifestyle_output,
                "medication": medication_output,
                "explainability": explainability_output,
            },
            final_message=message_bundle["final_message"] or "",
            detailed_message=message_bundle.get("detailed_message"),
            summary_message=message_bundle.get("summary_message"),
            doctor_note="The doctor remains the final decision-maker.",
        )
