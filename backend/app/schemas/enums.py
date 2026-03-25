"""Enums for HealthSage document fields."""
from enum import StrEnum


class UserRole(StrEnum):
    doctor = "doctor"
    patient = "patient"
    admin = "admin"


class ConditionStatus(StrEnum):
    active = "active"
    resolved = "resolved"
    inactive = "inactive"


class SenderType(StrEnum):
    provider = "provider"
    assistant = "assistant"


class AlertSeverity(StrEnum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class StorageBackend(StrEnum):
    gridfs = "gridfs"
    s3 = "s3"
    local = "local"


class AnalysisJobType(StrEnum):
    risk_prediction = "risk_prediction"
    lifestyle_recommendation = "lifestyle_recommendation"
    full_analysis = "full_analysis"


class AnalysisJobStatus(StrEnum):
    queued = "queued"
    running = "running"
    failed = "failed"
    completed = "completed"
