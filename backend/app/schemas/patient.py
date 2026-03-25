"""Patient document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PatientDoc(BaseModel):
    """Mongo document shape for patients collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: Optional[str] = None  # optional display id (e.g. UoM2301) for frontend
    full_name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
    neo4j_synced_at: Optional[datetime] = None

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
