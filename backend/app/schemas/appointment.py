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
