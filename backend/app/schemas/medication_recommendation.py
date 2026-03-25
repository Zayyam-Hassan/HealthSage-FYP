"""Strict output schema for medication recommendation engine (CDS, not prescriber)."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ----- Request / response for recommend-medication API -----


class RecommendMedicationRequest(BaseModel):
    """Request body for medication recommendation (optional; patient_id can also come from path)."""
    patient_id: Optional[str] = None
    risk_score: Optional[float] = None
    observations: Optional[Dict[str, Any]] = None
    lab_values: Optional[Dict[str, Any]] = None
    conditions: Optional[List[str]] = None
    lifestyle_factors: Optional[Dict[str, Any]] = None
    current_medications: Optional[List[str]] = None
    preferred_provider: Optional[str] = Field(default="grok", description="grok or mistral")


class AgentTraceEntry(BaseModel):
    """One step in the pipeline for frontend progress or audit."""
    agent: str = Field(..., description="e.g. clinical_reasoning_agent")
    stage: str = Field(..., description="started | completed | failed")
    label: str = Field(..., description="Frontend-friendly label")
    duration_ms: Optional[float] = None
    status: str = Field(..., description="ok | failed")
    error: Optional[str] = None


class RecommendMedicationResponse(BaseModel):
    """Structured response for recommend-medication with trace and safety fields."""
    recommended_medications: List[Any] = Field(default_factory=list)
    clinical_reasoning: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    confidence_score: float = Field(..., ge=0, le=1)
    agent_trace: List[AgentTraceEntry] = Field(default_factory=list)
    primary_option: Optional[Dict[str, Any]] = None
    alternatives: Optional[List[Dict[str, Any]]] = None
    missing_information: List[str] = Field(default_factory=list)
    doctor_note: Optional[str] = None
    safety_flags: Optional[Dict[str, Any]] = None
    recommendation_id: Optional[str] = None
    patient_id: Optional[str] = None


# ----- Multi-agent pipeline stage outputs -----


class ClinicalReasoningOutput(BaseModel):
    """Output of Clinical Reasoning Agent."""
    clinical_summary: str = Field(..., description="Summary of diabetic state and context")
    key_risk_factors: List[str] = Field(default_factory=list)
    treatment_goals: List[str] = Field(default_factory=list)
    contraindication_signals: List[str] = Field(default_factory=list)
    reasoning: str = Field(default="")


class MedicationCandidateItem(BaseModel):
    """One candidate from the Candidate Generator Agent."""
    name: str = Field(..., description="Medication name")
    reason: str = Field(default="")
    priority: int = Field(default=1, ge=1)


class CandidateGeneratorOutput(BaseModel):
    """Output of Medication Candidate Generator Agent."""
    candidate_medications: List[MedicationCandidateItem] = Field(default_factory=list)
    generator_notes: str = Field(default="")


class RemovedMedication(BaseModel):
    """A candidate removed by the Safety Validator with reason."""
    name: str = Field(...)
    reason: str = Field(default="")


class SafetyValidationOutput(BaseModel):
    """Output of Safety Validator Agent."""
    validated_medications: List[Any] = Field(default_factory=list)
    removed_medications: List[RemovedMedication] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    safety_notes: str = Field(default="")


class ConsensusOutput(BaseModel):
    """Output of Consensus Agent (final decision support)."""
    recommended_medications: List[Any] = Field(default_factory=list)
    final_reasoning: str = Field(default="")
    warnings: List[str] = Field(default_factory=list)
    confidence_score: float = Field(default=0.0, ge=0, le=1)


# ----- Lifecycle events (frontend / observability) -----


class MedicationLifecycleEvent(BaseModel):
    """Application-level lifecycle event for pipeline/agent/provider."""
    event_type: str = Field(..., description="e.g. pipeline_started, agent_completed, llm_request_started")
    pipeline: str = Field(default="medication_recommendation")
    agent: Optional[str] = None
    provider: Optional[str] = None
    stage: str = Field(..., description="started | completed | failed")
    label: str = Field(default="")
    timestamp: str = Field(...)
    request_id: Optional[str] = None
    patient_id: Optional[str] = None
    duration_ms: Optional[float] = None
    error: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


# ----- Existing CDS output schema -----


class EvidenceSource(BaseModel):
    """One cited evidence source (title + URL)."""
    title: str = Field(..., description="Source title")
    url: str = Field(..., description="Source URL")


class MedicationOption(BaseModel):
    """A single medication suggestion (primary or alternative)."""
    drug_name: str = Field(..., description="Medication name")
    drug_class: str = Field(..., description="Drug class")
    why: List[str] = Field(..., description="Reasoning for this option")
    evidence_sources: List[EvidenceSource] = Field(..., description="Cited evidence")
    confidence_note: str = Field(..., description="Note on confidence")
    flagged_for_review: bool = Field(default=False, description="Safety or review flag")


class MedicationRecommendationOutput(BaseModel):
    """Full medication suggestion plan. Must include doctor_note; never prescriptive language."""
    primary_option: MedicationOption = Field(..., description="Primary suggested option")
    alternatives: List[MedicationOption] = Field(default_factory=list, description="Alternative options")
    missing_information: List[str] = Field(default_factory=list, description="Gaps in context")
    doctor_note: str = Field(..., description="Required note that clinician must confirm")


# ----- Mongo document for medication_recommendations collection -----


class MedicationRecommendationDoc(BaseModel):
    """Mongo document shape for medication_recommendations (stored by pipeline)."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: Optional[PyObjectId] = None
    context_snapshot: Dict[str, Any] = Field(default_factory=dict)
    retrieved_sources: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_block: str = ""
    clinical_reasoning: str = ""
    candidate_output: Dict[str, Any] = Field(default_factory=dict)
    safety_output: Dict[str, Any] = Field(default_factory=dict)
    consensus_output: Dict[str, Any] = Field(default_factory=dict)
    llm_raw_output: Optional[str] = None
    safety_flags: Dict[str, Any] = Field(default_factory=dict)
    model_used: str = ""
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
