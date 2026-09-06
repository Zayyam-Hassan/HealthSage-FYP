# HealthSage MongoDB schema and index setup

Minimal Mongo-first schema layer. No seed data, no Neo4j sync in this layer.

## What each schema is for

| Collection | Purpose |
|------------|--------|
| **users** | Doctors, nurses, admins: auth identity, display name, role. |
| **patients** | Patient master: full_name, demographics. Optional `neo4j_synced_at` for later sync. |
| **observations** | Lab/vital values: `patient_id`, `observation_code`, value_numeric/text, effective_at. |
| **conditions** | Diagnoses: patient_id, code, display_name, status (active/resolved/inactive). |
| **analysis_jobs** | Async job queue: risk_prediction, lifestyle_recommendation, full_analysis; status queued/running/failed/completed. |
| **risk_predictions** | Output of risk model: patient_id, model_name, probability, predicted_label. |
| **lifestyle_recommendations** | Output of lifestyle pipeline: patient_id, plan (dict). |
| **conversations** | Chat threads; optional patient_id. |
| **messages** | Chat messages: conversation_id, sender_type (provider \| assistant), sender_user_id (if provider), body, attachment_ids (→ blobs). |
| **alerts** | Clinical/system alerts: severity, type, title, body; optional acknowledged_at / acknowledged_by. |
| **blobs** | File metadata; actual bytes in GridFS/S3/local. Referenced by messages.attachment_ids. |

## Where things live

- **app/core/config.py** – `MONGO_URI`, `MONGO_DB_NAME` (env).
- **app/db/mongodb.py** – `get_client()`, `get_db()` (PyMongo sync).
- **app/db/indexes.py** – `ensure_indexes(db)`.
- **app/schemas/** – Pydantic v2 document models + **app/schemas/objectid.py** (ObjectId support) + **app/schemas/enums.py**.
- **app/models/** – Re-exports of `*Doc` from schemas.

## How indexes are initialized

- **Startup:** `main.py` registers a FastAPI `startup` event that calls `ensure_indexes(get_db())`. If MongoDB is unreachable, startup does not fail (index creation is skipped).
- **Manual:** You can call `from app.db import get_db, ensure_indexes; ensure_indexes(get_db())` from a script or shell.

## Indexes created

- **users:** `email` (unique).
- **observations:** `patient_id`; compound `(patient_id, observation_code, effective_at desc)`.
- **conditions:** `patient_id`.
- **analysis_jobs:** compound `(patient_id, status)`.
- **risk_predictions:** compound `(patient_id, created_at desc)`.
- **lifestyle_recommendations:** compound `(patient_id, created_at desc)`.
- **messages:** compound `(conversation_id, created_at)`.
- **alerts:** compound `(patient_id, created_at desc)`.
- **blobs:** `uploaded_by`.

All datetimes in schemas use UTC (`datetime.now(timezone.utc)`).
