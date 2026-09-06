from typing import Any, Dict

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from pydantic import BaseModel, EmailStr

from app.db import get_db
from app.schemas.user import UserDoc, _utc_now  # type: ignore[attr-defined]
from app.schemas.enums import UserRole


router = APIRouter(prefix="/auth", tags=["auth"])


def _get_db() -> Database:
    return get_db()


def _hash_password(password: str) -> str:
    pw = password.encode("utf-8")
    if len(pw) > 256:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password is too long",
        )
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


class SignupPayload(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: str  # "patient" | "doctor"


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    role: UserRole


def _to_public(doc: Dict[str, Any]) -> UserPublic:
    user = UserDoc.model_validate(doc)
    return UserPublic(
      id=str(user.id) if user.id is not None else "",
      email=user.email,
      display_name=user.display_name,
      role=user.role,
    )


@router.post("/signup", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupPayload, db: Database = Depends(_get_db)) -> UserPublic:
    """Create a new user in users collection with hashed password."""
    email = payload.email.lower()
    display_name = payload.username.strip()

    if not display_name:
        raise HTTPException(status_code=422, detail="Username is required")

    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already exists")

    # Map UI role to UserRole; only doctor/patient are allowed via this endpoint
    if payload.role == "doctor":
        role = UserRole.doctor
    elif payload.role == "patient":
        role = UserRole.patient
    else:
        raise HTTPException(status_code=400, detail="Unsupported role")

    doc: Dict[str, Any] = {
        "email": email,
        "display_name": display_name,
        "role": role,
        "hashed_password": _hash_password(payload.password),
        "avatar_url": None,
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
        "last_login_at": None,
        "disabled": False,
    }

    res = db.users.insert_one(doc)
    created = db.users.find_one({"_id": res.inserted_id})
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create user")

    return _to_public(created)


@router.post("/login", response_model=UserPublic)
def login(payload: LoginPayload, db: Database = Depends(_get_db)) -> UserPublic:
    """Authenticate user by email & password against users collection."""
    email = payload.email.lower()
    doc = db.users.find_one({"email": email, "disabled": False})
    if not doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = UserDoc.model_validate(doc)
    if not _verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    db.users.update_one(
        {"_id": doc["_id"]},
        {"$set": {"last_login_at": _utc_now(), "updated_at": _utc_now()}},
    )

    return _to_public(doc)
