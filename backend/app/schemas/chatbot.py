"""Chatbot request and response schemas for the clinical assistant."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single message in a conversation (for multi-turn chat)."""
    role: str = Field(..., description="user | assistant")
    content: str = Field(default="", description="Message text")


class DoctorAssessment(BaseModel):
    """Optional doctor input for compare mode."""
    diagnosis: Optional[str] = None
    planned_medications: List[str] = Field(default_factory=list)
    planned_lifestyle: List[str] = Field(default_factory=list)


class WhatIfChanges(BaseModel):
    """Hypothetical changes for what-if scenario (e.g. BMI, HbA1c)."""
    # Allow arbitrary numeric/string overrides for context fields
    model_config = {"extra": "allow"}


class ChatbotRequest(BaseModel):
    """Request to the clinical chatbot. Supports single-turn and multi-turn chat."""
    patient_id: str
    doctor_query: str = Field(default="", description="Free-text query from clinician (current message)")
    mode: str = Field(
        default="recommend",
        description="recommend | explain | what_if | compare | auto | master (master infers and calls agents/graph explainer as tools)"
    )
    message_history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Previous messages in this conversation (user/assistant); used for context and audit"
    )
    doctor_assessment: Optional[DoctorAssessment] = None
    what_if_changes: Optional[Dict[str, Any]] = None  # e.g. {"BMI": 27.0, "HbA1c": 7.1}


class ChatbotResponse(BaseModel):
    """Response from the clinical chatbot."""
    mode: str
    patient_id: str
    agent_outputs: Dict[str, Any] = Field(
        default_factory=dict,
        description="risk, lifestyle, medication, explainability, comparison, whatif as applicable"
    )
    final_message: str
    detailed_message: Optional[str] = Field(
        default=None,
        description="Expanded clinician-facing response when lifestyle or medication guidance is returned"
    )
    summary_message: Optional[str] = Field(
        default=None,
        description="Optional compact summary retained for debugging or compact-card use"
    )
    doctor_note: str = Field(default="The doctor remains the final decision-maker.")


class ChatWithHistoryRequest(BaseModel):
    """Request for chat endpoint that persists conversation and messages (ChatGPT-style)."""
    patient_id: str
    doctor_query: str = Field(..., description="Current user message")
    mode: str = Field(default="recommend", description="recommend | explain | what_if | compare | auto | master")
    conversation_id: Optional[str] = Field(None, description="Existing conversation; if omitted, a new one is created")
    subject: Optional[str] = Field(None, description="Subject for new conversation (default: Clinical chat)")
    doctor_assessment: Optional[DoctorAssessment] = None
    what_if_changes: Optional[Dict[str, Any]] = None


class TranscriptMessage(BaseModel):
    """Single message in transcript (for API response)."""
    id: Optional[str] = None
    role: str = Field(..., description="user | assistant")
    content: str = ""
    created_at: Optional[str] = None


class ConversationSummary(BaseModel):
    """Conversation list item for chatbot session picker."""
    conversation_id: str
    patient_id: str
    subject: str = "Clinical chat"
    preview: str = ""
    message_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PatientConversationListResponse(BaseModel):
    """All conversations for one patient, newest first."""
    patient_id: str
    conversations: List[ConversationSummary] = Field(default_factory=list)


class ConversationTranscriptResponse(BaseModel):
    """Transcript response for one conversation or latest conversation."""
    conversation_id: Optional[str] = None
    patient_id: str
    transcript: List[TranscriptMessage] = Field(default_factory=list)


class ChatWithHistoryResponse(BaseModel):
    """Response from chat endpoint: chatbot reply + conversation id + full transcript."""
    response: ChatbotResponse
    conversation_id: str
    message_id_user: Optional[str] = None
    message_id_assistant: Optional[str] = None
    transcript: List[TranscriptMessage] = Field(default_factory=list)
