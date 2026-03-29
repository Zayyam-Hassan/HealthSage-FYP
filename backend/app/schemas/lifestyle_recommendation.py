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
