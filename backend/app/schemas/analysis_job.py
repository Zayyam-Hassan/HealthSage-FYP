"""Analysis job (async risk/lifestyle/full) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .enums import AnalysisJobStatus, AnalysisJobType
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AnalysisJobDoc(BaseModel):
    """Mongo document shape for analysis_jobs collection. Tracks queued/running/completed jobs."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    patient_id: PyObjectId
    job_type: AnalysisJobType
    status: AnalysisJobStatus
    created_at: datetime = Field(default_factory=_utc_now)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
