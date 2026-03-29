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
