"""MongoDB connection utility (PyMongo sync)."""
from pymongo import MongoClient
from pymongo.database import Database
from bson import ObjectId

from app.core.config import settings

_client: MongoClient | None = None


def parse_patient_oid(patient_id: str) -> ObjectId:
    """Return ObjectId for patient_id; raises ValueError if invalid."""
    try:
        return ObjectId(patient_id)
    except Exception as e:
        raise ValueError(f"Invalid patient_id: {patient_id}") from e


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri)
    return _client


def get_db() -> Database:
    return get_client()[settings.mongo_db_name]
