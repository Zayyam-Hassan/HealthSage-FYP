"""
Master prompt agent: chatbot that infers when to call sub-agents or the graph explainer as tools.
Single conversational entry point; LLM decides which tools to invoke (risk, risk+explain, lifestyle, medication, explainability, what_if, compare) or replies without tools.
"""
from __future__ import annotations

import json
import logging
import os
import random
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

import httpx

from app.schemas.chatbot import ChatbotRequest, ChatbotResponse
from app.schemas.explainability import ExplainabilityPayload
from services.llm.base import resolve_timeout_seconds
from services.llm.concurrency import llm_sync_slot

from .doctor_comparison import compute_doctor_vs_model_diff
from .doctor_treatment_agent import DoctorTreatmentAgent
from .explainability_agent import ExplainabilityAgent
from .lifestyle_agent import LifestyleAgent
from .medication_agent import MedicationAgent
from .response_formatter import build_chatbot_detail_bundle, format_chatbot_summary
from .whatif_agent import WhatIfAgent
from services.what_if_analysis import extract_what_if_changes

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

# Same env as Grok/medication for one API key
MASTER_LLM_API_KEY = os.getenv("GROK_API_KEY") or os.getenv("LLM_API_KEY", "")
MASTER_LLM_BASE_URL = os.getenv("GROK_BASE_URL") or os.getenv("LLM_BASE_URL", "https://api.x.ai/v1/chat/completions")
MASTER_LLM_MODEL = os.getenv("GROK_MODEL") or os.getenv("LLM_MODEL", "grok-2-latest")
MASTER_LLM_TIMEOUT = resolve_timeout_seconds("MASTER_LLM_TIMEOUT", "GROK_TIMEOUT")
_MASTER_LLM_MAX_RETRIES = max(1, int(os.getenv("MASTER_LLM_MAX_RETRIES", "6")))
_MASTER_LLM_RETRY_BASE_SEC = float(os.getenv("MASTER_LLM_RETRY_BASE_SEC", "1.25"))


def _master_retry_delay_seconds(attempt: int, response: httpx.Response) -> float:
    delay = _MASTER_LLM_RETRY_BASE_SEC * (2**attempt) + random.uniform(0.0, 0.75)
    ra = response.headers.get("Retry-After")
    if ra:
        try:
            delay = max(delay, float(ra))
        except ValueError:
            pass
    return min(delay, 90.0)


TOOL_NAMES = [
    "get_risk",           # Prediction only (GraphSAGE score/label)
    "get_risk_explain",   # Prediction + graph explainer (feature importance, explanation)
    "get_lifestyle",      # Lifestyle recommendations agent
    "get_medication",     # Medication recommendations agent
    "get_explainability", # Explain risk + recommendations (why this patient)
    "what_if",            # What-if scenario (needs what_if_changes in payload)
    "compare",            # Compare doctor plan vs model (needs doctor_assessment in payload)
    "get_doctor_treatment_plan",  # Fetch stored doctor-authored treatment plan
]

# Tools that can run in parallel (no dependency on other tools)
INDEPENDENT_TOOLS = {"get_risk", "get_risk_explain", "get_lifestyle", "get_medication", "what_if", "get_doctor_treatment_plan"}
# Tools that reuse risk/lifestyle/medication when already computed
DEPENDENT_TOOLS = {"get_explainability", "compare"}

MASTER_SYSTEM_PROMPT = """You are a clinical decision-support chatbot for diabetes care. The user is a clinician asking about a specific patient.

You have access to tools. Based on the user's message, you must decide:
- Either call one or more tools (to fetch risk, explanations, lifestyle, medication, what-if, or comparison), then you will receive their results and synthesize a reply.
- Or reply without calling any tool (e.g. greeting, clarification, or when the question is not about risk/recommendations/explanation).

Available tools:
- get_risk: Get the patient's diabetes risk score and label only (GraphSAGE prediction). Use when the user asks for "risk", "score", "probability", "how high is the risk".
- get_risk_explain: Get risk score AND explanation (which factors drive the prediction, graph explainer). Use when the user asks "why", "explain the risk", "what drives the prediction", "factors".
- get_lifestyle: Get evidence-based lifestyle recommendations (diet, activity, sleep). Use when the user asks for "lifestyle", "diet", "exercise", "non-drug", "behavioral".
- get_medication: Get medication suggestions (with safety checks). Use when the user asks for "medication", "drug", "prescription", "treatment options".
- get_explainability: Get explanation of why we recommend what we recommend for this patient. Use when the user asks "why these recommendations", "explain the suggestions", "rationale".
- what_if: Run a what-if scenario (e.g. "what if BMI were 30?"). Use when the user asks "what if", "suppose", "hypothetical", "if we change". Requires hypothetical values to be provided in the request.
- compare: Compare the clinician's own plan (medications/lifestyle) with the model's suggestions. Use when the user says "compare", "my plan", "vs my plan", "against my assessment". Requires the clinician's plan in the request.
- get_doctor_treatment_plan: Fetch the current stored doctor-authored treatment plan (diagnosis, medications, lifestyle guidance, follow-up, doctor note). Use when the user asks what the doctor prescribed, what the current treatment goal is, what lifestyle advice the doctor gave, or what follow-up note is on file.

Output ONLY valid JSON, no markdown or extra text:
{
  "tools": ["tool_name1", "tool_name2"],
  "reply_without_tools": null
}
If you need to call tools, set "tools" to a list of tool names (use exactly the names above) and set "reply_without_tools" to null.
If you do NOT need to call any tool (greeting, clarification, or off-topic), set "tools" to [] and set "reply_without_tools" to your short reply string.
"""

SYNTHESIZE_SYSTEM_PROMPT = """You are a clinical decision-support assistant. You will be given the clinician's question and the raw results from the tools that were run (risk, lifestyle, medication, explanations, etc.). Your job is to write a single, clear, clinically readable reply that:
1. Directly answers the clinician's question using only the tool results.
2. Does not add medical advice beyond what the tool results support.
3. If the tool results include lifestyle recommendations, do NOT give a short summary. Provide a detailed response with readable section labels and bullet points covering:
   - patient context relevant to lifestyle advice
   - why the lifestyle recommendations are being made
   - diet guidance
   - physical activity guidance
   - sleep guidance
   - stress, routine, or behavioral guidance
   - monitoring or follow-up advice
   - cautions or limitations
   - clinician review note
4. If the tool results include medication recommendations, do NOT give a short summary. Provide a detailed response with readable section labels and bullet points covering:
   - patient context relevant to medication choice
   - why the medication matches the patient
   - supporting drug evidence
   - supporting guideline evidence when available
   - key warnings
   - interaction notes
   - contraindication or caution notes
   - why some options were deprioritized or not selected as primary
   - next-step note requiring clinician review
5. For medication and lifestyle guidance, the main reply must be detailed and explanatory rather than compressed into a single paragraph.
6. For other flows without lifestyle or medication guidance, you may remain concise.
7. Use clean plain text with section labels and bullets. Do not output JSON.
8. End with a brief reminder that the clinician remains the final decision-maker."""


def _call_master_llm(system: str, user: str) -> str:
    if not MASTER_LLM_API_KEY:
        raise RuntimeError("GROK_API_KEY or LLM_API_KEY is not set; required for master chatbot.")
    payload = {
        "model": MASTER_LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {MASTER_LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=MASTER_LLM_TIMEOUT) as client:
        data: Dict[str, Any] = {}
        for attempt in range(_MASTER_LLM_MAX_RETRIES):
            with llm_sync_slot():
                resp = client.post(MASTER_LLM_BASE_URL, headers=headers, json=payload)
            if resp.status_code in (429, 502, 503, 504) and attempt < _MASTER_LLM_MAX_RETRIES - 1:
                time.sleep(_master_retry_delay_seconds(attempt, resp))
                continue
            resp.raise_for_status()
            data = resp.json()
            break
    if "choices" in data:
        content = data["choices"][0].get("message", {}).get("content", "")
    else:
        content = data.get("message", {}).get("content", "")
    return (content or "").strip()


def _parse_tool_decision(llm_output: str) -> Dict[str, Any]:
    """Extract JSON from LLM output; return { tools: [...], reply_without_tools: str | null }."""
    out = {"tools": [], "reply_without_tools": None}
    text = (llm_output or "").strip()
    # Strip markdown code block if present
    if "```" in text:
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if m:
            text = m.group(1)
    else:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            text = m.group(0)
    try:
        parsed = json.loads(text)
        out["tools"] = parsed.get("tools") or []
        if not isinstance(out["tools"], list):
            out["tools"] = []
        out["tools"] = [t for t in out["tools"] if isinstance(t, str) and t in TOOL_NAMES]
        out["reply_without_tools"] = parsed.get("reply_without_tools")
    except (json.JSONDecodeError, TypeError):
        logger.warning("Master agent: could not parse tool decision JSON; using no tools.")
    return out


def _looks_like_doctor_treatment_query(query: str) -> bool:
    q = (query or "").strip().lower()
    return any(
        token in q
        for token in [
            "doctor treatment",
            "treatment plan",
            "doctor plan",
            "doctor note",
            "follow-up note",
            "follow up note",
            "what has the doctor prescribed",
            "what did the doctor prescribe",
            "doctor prescribed",
            "lifestyle advice did the doctor",
            "current treatment goal",
            "current doctor plan",
        ]
    )


class MasterAgent:
    """Chatbot that infers which tools (agents / graph explainer) to call and synthesizes a reply."""

    def __init__(self) -> None:
        self._lifestyle = LifestyleAgent()
        self._medication = MedicationAgent()
        self._explainability = ExplainabilityAgent()
        self._whatif = WhatIfAgent()
        self._doctor_treatment = DoctorTreatmentAgent()

    def _run_tool(
        self,
        tool_name: str,
        patient_id: str,
        payload: ChatbotRequest,
        agent_outputs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Run a single tool and return its result. agent_outputs lets dependent tools reuse already-fetched data."""
        agent_outputs = agent_outputs or {}
        try:
            if tool_name == "get_risk":
                from services.risk.prediction_service import predict_patient_risk
                return predict_patient_risk(patient_id)

            if tool_name == "get_risk_explain":
                from services.risk.risk_service import get_risk_with_explanation
                return get_risk_with_explanation(patient_id)

            if tool_name == "get_lifestyle":
                return self._lifestyle.run(patient_id)

            if tool_name == "get_medication":
                return self._medication.run(patient_id)

            if tool_name == "get_explainability":
                risk_output = agent_outputs.get("get_risk_explain") or agent_outputs.get("get_risk")
                if risk_output is None:
                    from services.risk.risk_service import get_risk_with_explanation
                    risk_output = get_risk_with_explanation(patient_id)
                lifestyle_output = agent_outputs.get("get_lifestyle")
                if lifestyle_output is None:
                    lifestyle_output = self._lifestyle.run(patient_id)
                medication_output = agent_outputs.get("get_medication")
                if medication_output is None:
                    medication_output = self._medication.run(patient_id)
                exp = self._explainability.explain_recommendations(
                    patient_id, risk_output, lifestyle_output, medication_output
                )
                return exp.model_dump() if isinstance(exp, ExplainabilityPayload) else exp

            if tool_name == "what_if":
                changes = payload.what_if_changes or {}
                return self._whatif.run(patient_id, changes, doctor_query=payload.doctor_query)

            if tool_name == "compare":
                risk_output = agent_outputs.get("get_risk_explain") or agent_outputs.get("get_risk")
                if risk_output is None:
                    from services.risk.risk_service import get_risk_with_explanation
                    risk_output = get_risk_with_explanation(patient_id)
                lifestyle_output = agent_outputs.get("get_lifestyle")
                if lifestyle_output is None:
                    lifestyle_output = self._lifestyle.run(patient_id)
                medication_output = agent_outputs.get("get_medication")
                if medication_output is None:
                    medication_output = self._medication.run(patient_id)
                doctor_assessment = (
                    payload.doctor_assessment.model_dump()
                    if payload.doctor_assessment is not None and hasattr(payload.doctor_assessment, "model_dump")
                    else (payload.doctor_assessment if isinstance(payload.doctor_assessment, dict) else {})
                )
                comparison = compute_doctor_vs_model_diff(
                    doctor_assessment,
                    {"risk": risk_output, "lifestyle": lifestyle_output, "medication": medication_output},
                )
                return comparison

            if tool_name == "get_doctor_treatment_plan":
                return self._doctor_treatment.run(patient_id)
        except Exception as e:
            logger.exception("Master agent: tool %s failed: %s", tool_name, e)
            return {"error": str(e), "tool": tool_name}
        return {}

    def handle(self, payload: ChatbotRequest) -> ChatbotResponse:
        """
        Run master chatbot: LLM decides which tools to call (or none), we run them, then LLM synthesizes the reply.
        """
        patient_id = payload.patient_id
        doctor_query = (payload.doctor_query or "").strip()
        message_history = payload.message_history or []

        # Build user text for tool-decision call
        history_blob = ""
        if message_history:
            recent = message_history[-4:]  # last 2 turns
            def _msg_line(m):
                role = getattr(m, "role", m.get("role", "user") if isinstance(m, dict) else "user")
                content = getattr(m, "content", m.get("content", "") if isinstance(m, dict) else "")
                return f"{role}: {content[:150]}..." if len(content) > 150 else f"{role}: {content}"
            history_blob = "Recent conversation:\n" + "\n".join(_msg_line(m) for m in recent) + "\n\n"
        user_text = f"{history_blob}Current message from clinician (about patient {patient_id}):\n{doctor_query or '(no message)'}"

        # Step 1: LLM decides tools or direct reply
        try:
            raw_decision = _call_master_llm(MASTER_SYSTEM_PROMPT, user_text)
        except Exception as e:
            logger.exception("Master agent: LLM call failed: %s", e)
            failure_message = "I couldn't process your request (LLM unavailable). Please try again or use a specific mode (Recommend, Explain, etc.)."
            return ChatbotResponse(
                mode="master",
                patient_id=patient_id,
                agent_outputs={},
                final_message=failure_message,
                detailed_message=None,
                summary_message=failure_message,
                doctor_note="The doctor remains the final decision-maker.",
            )

        decision = _parse_tool_decision(raw_decision)
        extracted_changes = extract_what_if_changes(doctor_query)
        if not decision["tools"] and extracted_changes:
            lowered = doctor_query.lower()
            if any(
                token in lowered
                for token in ("what if", "what-if", "simulate", "scenario", "suppose", " if ", "goes", "becomes")
            ):
                decision["tools"] = ["what_if"]
        if not decision["tools"] and _looks_like_doctor_treatment_query(doctor_query):
            decision["tools"] = ["get_doctor_treatment_plan"]

        # No tools: use reply_without_tools
        if not decision["tools"]:
            reply = decision.get("reply_without_tools") or "I'm here to help with risk assessment, stored doctor treatment plans, lifestyle and medication suggestions, explanations, what-if scenarios, and comparison with your plan. What would you like to know for this patient?"
            if isinstance(reply, str):
                pass
            else:
                reply = str(reply)
            return ChatbotResponse(
                mode="master",
                patient_id=patient_id,
                agent_outputs={},
                final_message=reply,
                detailed_message=None,
                summary_message=reply,
                doctor_note="The doctor remains the final decision-maker.",
            )

        # Step 2: Run tools — independent ones in parallel, then dependent (reuse results)
        agent_outputs: Dict[str, Any] = {}
        requested = [t for t in decision["tools"] if t in TOOL_NAMES]
        independent = [t for t in requested if t in INDEPENDENT_TOOLS]
        dependent = [t for t in requested if t in DEPENDENT_TOOLS]

        def run_one(name: str) -> tuple:
            return (name, self._run_tool(name, patient_id, payload))

        if independent:
            with ThreadPoolExecutor(max_workers=min(len(independent), 5)) as executor:
                futures = {executor.submit(run_one, name): name for name in independent}
                for future in as_completed(futures):
                    name, result = future.result()
                    agent_outputs[name] = result
        for tool_name in dependent:
            agent_outputs[tool_name] = self._run_tool(
                tool_name, patient_id, payload, agent_outputs=agent_outputs
            )

        # Step 3: Synthesize final message from tool results
        results_blob = json.dumps(agent_outputs, indent=2, default=str)[:12000]  # cap size
        synthesize_user = f"Clinician asked: \"{doctor_query}\"\n\nTool results:\n{results_blob}\n\nWrite your reply:"
        try:
            final_message = _call_master_llm(SYNTHESIZE_SYSTEM_PROMPT, synthesize_user)
        except Exception as e:
            logger.warning("Master agent: synthesize LLM failed: %s; using fallback.", e)
            risk_out = agent_outputs.get("get_risk_explain") or agent_outputs.get("get_risk")
            message_bundle = build_chatbot_detail_bundle(
                mode="recommend",
                risk_output=risk_out,
                lifestyle_output=agent_outputs.get("get_lifestyle"),
                medication_output=agent_outputs.get("get_medication"),
                explainability_output=agent_outputs.get("get_explainability"),
                comparison_output=agent_outputs.get("compare"),
                whatif_output=agent_outputs.get("what_if"),
                user_query=doctor_query,
            )
            final_message = message_bundle["final_message"] or ""
        else:
            risk_out = agent_outputs.get("get_risk_explain") or agent_outputs.get("get_risk")
            message_bundle = {
                "final_message": final_message,
                "detailed_message": final_message if (agent_outputs.get("get_lifestyle") or agent_outputs.get("get_medication")) else None,
                "summary_message": format_chatbot_summary(
                    mode="master",
                    risk_output=risk_out,
                    lifestyle_output=agent_outputs.get("get_lifestyle"),
                    medication_output=agent_outputs.get("get_medication"),
                    explainability_output=agent_outputs.get("get_explainability"),
                    comparison_output=agent_outputs.get("compare"),
                    whatif_output=agent_outputs.get("what_if"),
                    user_query=doctor_query,
                ),
            }

        return ChatbotResponse(
            mode="master",
            patient_id=patient_id,
            agent_outputs=agent_outputs,
            final_message=message_bundle["final_message"] or final_message,
            detailed_message=message_bundle.get("detailed_message"),
            summary_message=message_bundle.get("summary_message"),
            doctor_note="The doctor remains the final decision-maker.",
        )
