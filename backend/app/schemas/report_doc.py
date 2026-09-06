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
