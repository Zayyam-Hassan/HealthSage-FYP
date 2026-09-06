"""User (doctors/staff) document schema."""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from .enums import UserRole
from .objectid import PyObjectId


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserDoc(BaseModel):
    """Mongo document shape for users collection."""

    id: Optional[PyObjectId] = Field(None, alias="_id")
    email: EmailStr
    display_name: str
    role: UserRole
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
    last_login_at: Optional[datetime] = None
    disabled: bool = False
    hashed_password: str = Field(exclude=True)

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
