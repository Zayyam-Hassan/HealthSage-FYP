"""Blob (file) metadata document schema. Actual bytes in GridFS/S3/local."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

from .enums import StorageBackend
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BlobDoc(BaseModel):
    """Mongo document shape for blobs collection. References stored in messages.attachment_ids."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    storage_backend: StorageBackend
    storage_key: str
    filename: str
    content_type: str
    size_bytes: int
    uploaded_by: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
