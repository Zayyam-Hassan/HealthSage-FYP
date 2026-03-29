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
