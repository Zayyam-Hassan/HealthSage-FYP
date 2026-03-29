"""Medication catalog document schema (drug list for compatibility/UI)."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MedicationCatalogDoc(BaseModel):
    """Mongo document shape for medications (catalog) collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    medication_id: Optional[str] = None
    name: str
    brand_name: Optional[str] = None
    description: Optional[str] = None
    side_effects: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    how_to_use: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
