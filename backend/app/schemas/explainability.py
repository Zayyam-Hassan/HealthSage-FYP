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
