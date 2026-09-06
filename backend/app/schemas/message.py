"""Chat message document schema."""
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field

from .enums import SenderType
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MessageDoc(BaseModel):
    """Mongo document shape for messages collection. sender_user_id only for provider messages."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    conversation_id: PyObjectId
    sender_type: SenderType
    sender_user_id: Optional[PyObjectId] = None
    body: str
    attachment_ids: Optional[List[PyObjectId]] = None
    created_at: datetime = Field(default_factory=_utc_now)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
