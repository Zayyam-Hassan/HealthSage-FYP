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
