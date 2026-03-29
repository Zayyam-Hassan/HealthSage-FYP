"""Minimal config: MongoDB URI and DB name from env."""
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "HealthSage_v1")


class _Settings:
    mongo_uri: str = MONGO_URI
    mongo_db_name: str = MONGO_DB_NAME


settings = _Settings()
