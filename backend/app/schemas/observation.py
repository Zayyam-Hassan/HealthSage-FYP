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
