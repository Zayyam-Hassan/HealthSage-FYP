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
