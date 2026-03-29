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
