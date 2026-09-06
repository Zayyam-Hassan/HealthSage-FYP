"""Minimal config: MongoDB URI and DB name from env."""
import os
from pathlib import Path

from dotenv import load_dotenv

# backend/.env (same folder as app/) — must load before os.getenv or settings stay at defaults
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_BACKEND_ROOT / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "HealthSage_v1")


class _Settings:
    mongo_uri: str = MONGO_URI
    mongo_db_name: str = MONGO_DB_NAME


settings = _Settings()
