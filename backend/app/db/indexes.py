"""Create MongoDB indexes for HealthSage collections. Call ensure_indexes(get_db()) on startup."""
from pymongo.database import Database
from pymongo import ASCENDING, DESCENDING


def ensure_indexes(db: Database) -> None:
    """Create the minimal set of indexes required for the app. Idempotent."""
    # users
    db.users.create_index("email", unique=True)

    # observations
    db.observations.create_index("patient_id")
    db.observations.create_index(
        [("patient_id", ASCENDING), ("observation_code", ASCENDING), ("effective_at", DESCENDING)]
    )

    # conditions
    db.conditions.create_index("patient_id")

    # analysis_jobs
    db.analysis_jobs.create_index([("patient_id", ASCENDING), ("status", ASCENDING)])

    # risk_predictions
    db.risk_predictions.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])

    # lifestyle_recommendations
    db.lifestyle_recommendations.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])

    # medication_recommendations
    db.medication_recommendations.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])

    # audit_logs
    db.audit_logs.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])
    db.audit_logs.create_index("event")

    # risk_audit_logs
    db.risk_audit_logs.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])

    # chatbot_audit_logs
    db.chatbot_audit_logs.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])
    db.chatbot_audit_logs.create_index("mode")

    # messages
    db.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])

    # alerts
    db.alerts.create_index([("patient_id", ASCENDING), ("created_at", DESCENDING)])

    # blobs
    db.blobs.create_index("uploaded_by")
