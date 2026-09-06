"""
Main clinical chatbot endpoint: POST /chatbot/clinical-assistant.
Chat with history (ChatGPT-style): POST /chatbot/chat (persists conversation + messages).
Patient context: GET /chatbot/patient-context/{patient_id}.
Transcript: GET /chatbot/conversations/{conversation_id}/transcript.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.db import get_db
from app.schemas.chatbot import (
    ChatMessage,
    ChatbotRequest,
    ChatbotResponse,
    ChatWithHistoryRequest,
    ChatWithHistoryResponse,
    ConversationSummary,
    ConversationTranscriptResponse,
    DiagnosisIdentificationRequest,
    DiagnosisIdentificationResponse,
    PatientConversationListResponse,
    TranscriptMessage,
)
from app.schemas.enums import SenderType
from services.agents.coordinator_agent import CoordinatorAgent
from services.agents.master_agent import MasterAgent
from services.agents.patient_context_service import build_patient_session_context
from services.agents.master_agent import _call_master_llm

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ObjectId") from None


DIAGNOSIS_IDENTIFICATION_SYSTEM_PROMPT = """You classify a doctor's message.

Task: Determine whether the message clearly contains the doctor's own diagnosis or clinical assessment/impression for a patient.

Return ONLY valid JSON:
{
  "is_diagnosis_or_assessment": true or false,
  "confidence": number between 0 and 1,
  "rationale": "one short sentence"
}

Guidance:
- true when the doctor states or implies their clinical judgment, impression, differential, working/provisional diagnosis, or assessment.
- false for generic questions, requests for recommendations, or instructions without any judgment.
"""


@router.post("/identify-diagnosis", response_model=DiagnosisIdentificationResponse)
async def identify_diagnosis(payload: DiagnosisIdentificationRequest):
    try:
        raw = await run_in_threadpool(
            _call_master_llm,
            DIAGNOSIS_IDENTIFICATION_SYSTEM_PROMPT,
            payload.doctor_query or "",
        )
        import json
        import re

        text = (raw or "").strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(match.group(0) if match else text)
        is_diag = bool(parsed.get("is_diagnosis_or_assessment", False))
        confidence = float(parsed.get("confidence", 0.0) or 0.0)
        confidence = max(0.0, min(1.0, confidence))
        rationale = str(parsed.get("rationale", "") or "").strip()
        return DiagnosisIdentificationResponse(
            is_diagnosis_or_assessment=is_diag,
            confidence=confidence,
            rationale=rationale,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnosis identification failed: {e}") from e


@router.get("/patient-context/{patient_id}")
async def get_patient_context(patient_id: str):
    """
    Build full patient context when a doctor opens the chatbot for a patient,
    or when a patient logs in. Call this on session open so the UI can show
    risk, context summary, and latest recommendations immediately.
    """
    try:
        return await run_in_threadpool(build_patient_session_context, patient_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def _audit_log(payload: ChatbotRequest, response: ChatbotResponse) -> None:
    """Store request and response in chatbot_audit_logs."""
    try:
        db = get_db()
        doc = {
            "patient_id": payload.patient_id,
            "mode": payload.mode,
            "doctor_query": payload.doctor_query[:500] if payload.doctor_query else "",
            "request_payload": payload.model_dump(),
            "agent_outputs_keys": list((response.agent_outputs or {}).keys()),
            "risk_output": response.agent_outputs.get("risk"),
            "lifestyle_output": response.agent_outputs.get("lifestyle"),
            "medication_output": response.agent_outputs.get("medication"),
            "explainability_output": response.agent_outputs.get("explainability"),
            "comparison_output": response.agent_outputs.get("comparison"),
            "whatif_output": response.agent_outputs.get("whatif"),
            "final_message": response.final_message[:2000] if response.final_message else "",
            "created_at": datetime.now(timezone.utc),
        }
        db.chatbot_audit_logs.insert_one(doc)
    except Exception:
        pass


def _serialize_message(message_doc: Dict[str, Any]) -> TranscriptMessage:
    return TranscriptMessage(
        id=str(message_doc["_id"]),
        role="user" if message_doc.get("sender_type") == SenderType.provider else "assistant",
        content=message_doc.get("body", ""),
        created_at=message_doc.get("created_at").isoformat() if message_doc.get("created_at") else None,
    )


def _build_conversation_summary(db: Any, patient_id: str, conv_doc: Dict[str, Any]) -> ConversationSummary:
    conv_oid = conv_doc["_id"]
    messages = list(
        db.messages.find({"conversation_id": conv_oid}).sort("created_at", 1)
    )
    preview = ""
    if messages:
        last_body = (messages[-1].get("body") or "").strip()
        preview = last_body[:180]
    return ConversationSummary(
        conversation_id=str(conv_oid),
        patient_id=patient_id,
        subject=(conv_doc.get("subject") or "Clinical chat").strip() or "Clinical chat",
        preview=preview,
        message_count=len(messages),
        created_at=conv_doc.get("created_at").isoformat() if conv_doc.get("created_at") else None,
        updated_at=conv_doc.get("updated_at").isoformat() if conv_doc.get("updated_at") else None,
    )


@router.post("/clinical-assistant", response_model=ChatbotResponse)
async def clinical_assistant(payload: ChatbotRequest):
    """
    Main chatbot endpoint. Modes: recommend | explain | what_if | compare | auto | master.
    master = single chatbot that infers and calls agents/graph explainer as tools.
    Returns structured response with agent_outputs and final_message.
    """
    try:
        mode = (payload.mode or "recommend").strip().lower()
        if mode == "master":
            master = MasterAgent()
            response = await run_in_threadpool(master.handle, payload)
        else:
            coordinator = CoordinatorAgent()
            response = await run_in_threadpool(coordinator.handle_request, payload)
        _audit_log(payload, response)
        return response
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/patients/{patient_id}/conversations", response_model=PatientConversationListResponse)
def list_patient_conversations(patient_id: str):
    """
    Return all saved chatbot sessions for a patient, newest first.
    """
    db = get_db()
    patient_oid = _oid(patient_id)
    conversations = list(
        db.conversations.find({"patient_id": patient_oid}).sort("updated_at", -1)
    )
    return PatientConversationListResponse(
        patient_id=patient_id,
        conversations=[_build_conversation_summary(db, patient_id, conv) for conv in conversations],
    )


@router.get("/patients/{patient_id}/conversation", response_model=ConversationTranscriptResponse)
def get_latest_patient_conversation(patient_id: str):
    """
    Return the latest conversation transcript for a patient.
    """
    db = get_db()
    patient_oid = _oid(patient_id)
    conv_doc = db.conversations.find_one(
        {"patient_id": patient_oid},
        sort=[("updated_at", -1)],
    )
    if not conv_doc:
        return ConversationTranscriptResponse(patient_id=patient_id, conversation_id=None, transcript=[])
    messages = list(
        db.messages.find({"conversation_id": conv_doc["_id"]}).sort("created_at", 1)
    )
    return ConversationTranscriptResponse(
        patient_id=patient_id,
        conversation_id=str(conv_doc["_id"]),
        transcript=[_serialize_message(m) for m in messages],
    )


@router.post("/chat", response_model=ChatWithHistoryResponse)
def chat_with_history(payload: ChatWithHistoryRequest):
    """
    ChatGPT-style chat: persists each turn to a conversation and messages.
    Pass conversation_id to continue a thread; omit to start a new one.
    Returns the chatbot response plus conversation_id and full transcript.
    """
    db = get_db()
    patient_oid = _oid(payload.patient_id)

    # Get or create conversation
    if payload.conversation_id:
        conv_doc = db.conversations.find_one({"_id": _oid(payload.conversation_id)})
        if not conv_doc:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation_id = payload.conversation_id
    else:
        ins = db.conversations.insert_one({
            "patient_id": patient_oid,
            "subject": payload.subject or "Clinical chat",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        conversation_id = str(ins.inserted_id)
        db.conversations.update_one(
            {"_id": ins.inserted_id},
            {"$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    conv_oid = _oid(conversation_id)

    # Load existing messages for context (before adding current turn)
    existing = list(
        db.messages.find({"conversation_id": conv_oid})
        .sort("created_at", 1)
    )
    message_history = [
        ChatMessage(
            role="user" if m.get("sender_type") == SenderType.provider else "assistant",
            content=m.get("body", ""),
        )
        for m in existing
    ]

    # Append user message
    user_msg = {
        "conversation_id": conv_oid,
        "sender_type": SenderType.provider,
        "body": payload.doctor_query,
        "created_at": datetime.now(timezone.utc),
    }
    res_user = db.messages.insert_one(user_msg)
    message_id_user = str(res_user.inserted_id)

    # Call clinical assistant
    chat_payload = ChatbotRequest(
        patient_id=payload.patient_id,
        doctor_query=payload.doctor_query,
        mode=payload.mode or "recommend",
        message_history=message_history,
        doctor_assessment=payload.doctor_assessment,
        what_if_changes=payload.what_if_changes,
    )
    mode = (chat_payload.mode or "recommend").strip().lower()
    if mode == "master":
        master = MasterAgent()
        response = master.handle(chat_payload)
    else:
        coordinator = CoordinatorAgent()
        response = coordinator.handle_request(chat_payload)
    _audit_log(chat_payload, response)

    # Append assistant message
    assistant_msg = {
        "conversation_id": conv_oid,
        "sender_type": SenderType.assistant,
        "body": response.final_message or "",
        "created_at": datetime.now(timezone.utc),
    }
    res_asst = db.messages.insert_one(assistant_msg)
    message_id_assistant = str(res_asst.inserted_id)
    db.conversations.update_one(
        {"_id": conv_oid},
        {
            "$set": {
                "updated_at": datetime.now(timezone.utc),
                "subject": (
                    payload.subject
                    or (payload.doctor_query[:80].strip() if payload.doctor_query else "Clinical chat")
                    or "Clinical chat"
                ),
            }
        },
    )

    # Build transcript (all messages in order, including the two we just added)
    transcript: List[TranscriptMessage] = [_serialize_message(m) for m in existing]
    transcript.append(TranscriptMessage(
        id=message_id_user,
        role="user",
        content=payload.doctor_query,
        created_at=user_msg.get("created_at").isoformat() if user_msg.get("created_at") else None,
    ))
    transcript.append(TranscriptMessage(
        id=message_id_assistant,
        role="assistant",
        content=response.final_message or "",
        created_at=assistant_msg.get("created_at").isoformat() if assistant_msg.get("created_at") else None,
    ))

    return ChatWithHistoryResponse(
        response=response,
        conversation_id=conversation_id,
        message_id_user=message_id_user,
        message_id_assistant=message_id_assistant,
        transcript=transcript,
    )


@router.get("/conversations/{conversation_id}/transcript", response_model=ConversationTranscriptResponse)
def get_conversation_transcript(conversation_id: str):
    """
    Return the full transcript (messages in order) for a conversation.
    Use this to display chat history like ChatGPT.
    """
    db = get_db()
    conv_doc = db.conversations.find_one({"_id": _oid(conversation_id)})
    if not conv_doc:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = list(
        db.messages.find({"conversation_id": _oid(conversation_id)}).sort("created_at", 1)
    )
    return ConversationTranscriptResponse(
        patient_id=str(conv_doc.get("patient_id")) if conv_doc.get("patient_id") else "",
        conversation_id=conversation_id,
        transcript=[_serialize_message(m) for m in messages],
    )
