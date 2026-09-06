## Schemas code dump

### File: `enums.py`

```python
"""Enums for HealthSage document fields."""
from enum import StrEnum


class UserRole(StrEnum):
    doctor = "doctor"
    patient = "patient"
    admin = "admin"


class ConditionStatus(StrEnum):
    active = "active"
    resolved = "resolved"
    inactive = "inactive"


class SenderType(StrEnum):
    provider = "provider"
    assistant = "assistant"


class AlertSeverity(StrEnum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class StorageBackend(StrEnum):
    gridfs = "gridfs"
    s3 = "s3"
    local = "local"


class AnalysisJobType(StrEnum):
    risk_prediction = "risk_prediction"
    lifestyle_recommendation = "lifestyle_recommendation"
    full_analysis = "full_analysis"


class AnalysisJobStatus(StrEnum):
    queued = "queued"
    running = "running"
    failed = "failed"
    completed = "completed"
```

### File: `user.py`

```python
"""User (doctors/staff) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from .enums import UserRole
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserDoc(BaseModel):
    """Mongo document shape for users collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    email: EmailStr
    display_name: str
    role: UserRole
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
    last_login_at: Optional[datetime] = None
    disabled: bool = False
    hashed_password: str = Field(exclude=True)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `medication_recommendation.py`

```python
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
```

### File: `lifestyle_recommendation.py`

```python
"""Lifestyle recommendation plan document schema and structured API response."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LifestyleEvidenceSource(BaseModel):
    title: str
    url: str = ""


class LifestyleRecommendationItem(BaseModel):
    """Single recommendation with reason and evidence."""
    recommendation: str
    reason: str = ""
    evidence_sources: List[LifestyleEvidenceSource] = Field(default_factory=list)


class LifestyleStructuredResponse(BaseModel):
    """Strict JSON schema for lifestyle output (clinician-facing)."""
    diet_recommendations: List[LifestyleRecommendationItem] = Field(default_factory=list)
    exercise_recommendations: List[LifestyleRecommendationItem] = Field(default_factory=list)
    sleep_recommendations: List[LifestyleRecommendationItem] = Field(default_factory=list)
    behavioral_recommendations: List[LifestyleRecommendationItem] = Field(default_factory=list)
    monitoring_recommendations: List[LifestyleRecommendationItem] = Field(default_factory=list)
    doctor_note: str = Field(
        default="Lifestyle guidance should be reviewed by the clinician in context of the patient's condition."
    )


class LifestyleRecommendationDoc(BaseModel):
    """Mongo document shape for lifestyle_recommendations collection. plan is a free-form dict."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    plan: Dict[str, Any]
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `alert.py`

```python
"""Alert (clinical/system) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .enums import AlertSeverity
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AlertDoc(BaseModel):
    """Mongo document shape for alerts collection. patient_id optional for system-wide alerts."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: Optional[PyObjectId] = None
    severity: AlertSeverity
    type: str
    title: str
    body: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `patient.py`

```python
"""Patient document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PatientDoc(BaseModel):
    """Mongo document shape for patients collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: Optional[str] = None  # optional display id (e.g. UoM2301) for frontend
    full_name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
    neo4j_synced_at: Optional[datetime] = None

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `doctor.py`

```python
"""Doctor document schema for frontend alignment (list/detail)."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DoctorDoc(BaseModel):
    """Mongo document shape for doctors collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    doctor_id: Optional[str] = None  # optional display id; default str(_id)
    name: str
    specialization: str
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `risk_prediction.py`

```python
"""Risk prediction (e.g. diabetes risk) document schema."""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RiskPredictionDoc(BaseModel):
    """Mongo document shape for risk_predictions collection. One per model run per patient."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    model_name: str
    probability: float
    predicted_label: int
    explanation: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Stored explanation (top_features, nodes, reasoning_paths, clinical_summary, etc.)",
    )
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `__init__.py`

```python
# Pydantic schemas (document shapes + ObjectId support)
from .objectid import PyObjectId

__all__ = ["PyObjectId"]
```

### File: `risk.py`

```python
"""Risk prediction and explanation schemas for the Risk Assessment layer."""
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RiskPredictionRequest(BaseModel):
    """Request for risk prediction (patient_id typically in path)."""
    patient_id: str = Field(..., description="MongoDB patient ID")


class FeatureImportance(BaseModel):
    """Single feature importance for explainability."""
    name: str
    importance: float


class RiskPredictionResponse(BaseModel):
    """Structured risk output from GraphSAGE."""
    patient_id: str
    risk_score: float = Field(..., ge=0, le=1)
    risk_label: str = Field(..., description="low | medium | high")
    model_name: str = "GraphSAGE"
    predicted_at: datetime = Field(default_factory=_utc_now)
    explanation_available: bool = True


class RiskExplanationResponse(BaseModel):
    """Graph/feature explanation for risk prediction."""
    risk_explanation: str
    top_features: List[FeatureImportance] = Field(default_factory=list)
    graph_context_summary: str = ""
    method: str = Field(default="feature_importance", description="e.g. GNNExplainer or feature_importance")
```

### File: `report_doc.py`

```python
"""Report document schema for frontend alignment."""
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReportDoc(BaseModel):
    """Mongo document shape for reports collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    title: str
    type: str = "other"  # lab_report | ai_summary | visit_summary | other
    content: dict[str, Any] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=_utc_now)
    generated_by: Optional[str] = None
    attachment_url: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `observation.py`

```python
"""Observation (lab/vital value) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ObservationDoc(BaseModel):
    """Mongo document shape for observations collection. Links to patient_id."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    observation_code: str
    value_numeric: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    effective_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_utc_now)
    neo4j_synced_at: Optional[datetime] = None

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `objectid.py`

```python
"""Pydantic v2 support for MongoDB ObjectId: validate str/ObjectId, serialize to str in JSON."""
from typing import Any

from bson import ObjectId
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


class PyObjectId(str):
    """Use in Pydantic models for fields that store MongoDB ObjectId. Accepts str or ObjectId; JSON serializes to str."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source_type: Any, handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        return core_schema.union_schema(
            [
                core_schema.is_instance_schema(ObjectId),
                core_schema.no_info_plain_validator_function(cls._validate),
            ],
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x) if isinstance(x, ObjectId) else x
            ),
        )

    @classmethod
    def _validate(cls, v: Any) -> ObjectId:
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and len(v) == 24:
            try:
                return ObjectId(v)
            except Exception:
                pass
        raise ValueError("invalid ObjectId")
```

### File: `message.py`

```python
"""Chat message document schema."""
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field

from .enums import SenderType
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MessageDoc(BaseModel):
    """Mongo document shape for messages collection. sender_user_id only for provider messages."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    conversation_id: PyObjectId
    sender_type: SenderType
    sender_user_id: Optional[PyObjectId] = None
    body: str
    attachment_ids: Optional[List[PyObjectId]] = None
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `medication_catalog.py`

```python
"""Medication catalog document schema (drug list for compatibility/UI)."""
from datetime as datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MedicationCatalogDoc(BaseModel):
    """Mongo document shape for medications (catalog) collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    medication_id: Optional[str] = None
    name: str
    brand_name: Optional[str] = None
    description: Optional[str] = None
    side_effects: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    how_to_use: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `explainability.py`

```python
"""Unified explainability payload for clinician-facing outputs."""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ----- Explain-risk API (dashboard + chatbot) -----


class ExplainRiskRequest(BaseModel):
    """Request for POST /explain-risk."""
    patient_id: str = Field(..., description="MongoDB patient ID")
    model_type: str = Field(default="graphsage", description="graphsage | hgt")


class TopFeatureOut(BaseModel):
    """Single top feature for UI."""
    feature: str
    importance: float
    value: str = ""


class ImportantNodeOut(BaseModel):
    """Important graph node for UI."""
    id: Optional[int] = None
    label: str
    type: str
    importance: float


class ImportantRelationshipOut(BaseModel):
    """Important relationship for UI."""
    source: str
    relation: str
    target: str
    importance: float


class VisualSubgraphNode(BaseModel):
    """Node for mini-graph."""
    id: str
    label: str
    type: str


class VisualSubgraphEdge(BaseModel):
    """Edge for mini-graph."""
    source: str
    target: str
    label: str


class VisualSubgraphOut(BaseModel):
    """Subgraph for explanation mini-graph."""
    nodes: List[VisualSubgraphNode] = Field(default_factory=list)
    edges: List[VisualSubgraphEdge] = Field(default_factory=list)


class RiskExplanationOut(BaseModel):
    """Full structured explanation for frontend and chatbot."""
    patient_id: Optional[Any] = None
    model_type: str = "graphsage"
    risk_prediction: float = 0.0
    risk_label: str = ""
    clinical_summary: str = ""
    top_features: List[TopFeatureOut] = Field(default_factory=list)
    important_nodes: List[ImportantNodeOut] = Field(default_factory=list)
    important_relationships: List[ImportantRelationshipOut] = Field(default_factory=list)
    reasoning_paths: List[str] = Field(default_factory=list)
    visual_subgraph: VisualSubgraphOut = Field(default_factory=VisualSubgraphOut)

    class Config:
        extra = "allow"


class ExplainRiskResponse(BaseModel):
    """Response for POST /explain-risk."""
    prediction: float = Field(..., description="Risk probability 0-1")
    risk_label: str = Field(..., description="Low Risk | Moderate Risk | High Risk")
    explanation: RiskExplanationOut = Field(..., description="Full structured explanation")


# ----- Existing clinician-facing payload -----


class EvidenceSummaryItem(BaseModel):
    """Single evidence source for explainability panel."""
    source_type: str = Field(..., description="model | web | graph")
    title: str
    detail: str = ""


class ExplainabilityPayload(BaseModel):
    """Combined explanation for risk, lifestyle, medication, safety, and optional what-if."""
    risk_explanation: str = ""
    lifestyle_explanation: str = ""
    medication_explanation: str = ""
    safety_explanation: str = ""
    whatif_explanation: Optional[str] = None
    evidence_summary: List[EvidenceSummaryItem] = Field(default_factory=list)
    doctor_note: str = Field(
        default="These outputs are decision-support suggestions and require clinician review."
    )
```

### File: `conversation.py`

```python
"""Conversation (chat thread) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ConversationDoc(BaseModel):
    """Mongo document shape for conversations collection. Optional patient_id for patient-scoped threads."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: Optional[PyObjectId] = None
    subject: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `condition.py`

```python
"""Condition (diagnosis) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .enums import ConditionStatus
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ConditionDoc(BaseModel):
    """Mongo document shape for conditions collection. Links to patient_id."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    code: str
    display_name: Optional[str] = None
    status: ConditionStatus
    created_at: datetime = Field(default_factory=_utc_now)
    neo4j_synced_at: Optional[datetime] = None

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `chatbot.py`

```python
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


class ChatWithHistoryResponse(BaseModel):
    """Response from chat endpoint: chatbot reply + conversation id + full transcript."""
    response: ChatbotResponse
    conversation_id: str
    message_id_user: Optional[str] = None
    message_id_assistant: Optional[str] = None
    transcript: List[TranscriptMessage] = Field(default_factory=list)
```

### File: `blob.py`

```python
"""Blob (file) metadata document schema. Actual bytes in GridFS/S3/local."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .enums import StorageBackend
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BlobDoc(BaseModel):
    """Mongo document shape for blobs collection. References stored in messages.attachment_ids."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    storage_backend: StorageBackend
    storage_key: str
    filename: str
    content_type: str
    size_bytes: int
    uploaded_by: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `appointment.py`

```python
"""Appointment document schema for frontend alignment."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AppointmentDoc(BaseModel):
    """Mongo document shape for appointments collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    doctor_id: PyObjectId
    scheduled_at: datetime
    status: str = "scheduled"  # scheduled | completed | cancelled | no_show
    reason: str = ""
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

### File: `analysis_job.py`

```python
"""Analysis job (async risk/lifestyle/full) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .enums import AnalysisJobStatus, AnalysisJobType
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AnalysisJobDoc(BaseModel):
    """Mongo document shape for analysis_jobs collection. Tracks queued/running/completed jobs."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    job_type: AnalysisJobType
    status: AnalysisJobStatus
    created_at: datetime = Field(default_factory=_utc_now)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
```

