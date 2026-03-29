# Cleanup pass (stabilization only)

Targeted cleanup to reduce duplication and consolidate Mongo/ID handling. No new features, no architecture changes.

## 1. Mongo `get_db` consolidation

- **Before**: Seven modules each defined a local `_get_db()` with the same try/except (config vs env) and `MongoClient(uri)[db_name]`.
- **After**: All use the existing **`app.db.get_db()`** from `app.db.mongodb` (already used by `main.py` for indexes).
- **Files updated**:  
  `services/medication/service.py`, `api/chatbot_routes.py`, `api/risk_routes.py`,  
  `services/medication/context_builder.py`, `services/agents/patient_context_service.py`,  
  `services/prediction/service.py`, `services/lifestyle/context_builder.py`
- **Behavior**: Unchanged when running under the FastAPI app (config is used). No new files.

## 2. Patient ID → ObjectId parsing

- **Before**: Four modules used the same pattern: `try: oid = ObjectId(patient_id); except Exception: raise ValueError(...)`.
- **After**: Shared helper **`app.db.parse_patient_oid(patient_id)`** in `app.db.mongodb`; same exception behavior.
- **Files updated**:  
  `services/medication/context_builder.py`, `services/lifestyle/context_builder.py`,  
  `services/prediction/service.py`, `services/agents/patient_context_service.py`
- **Export**: `app.db.parse_patient_oid` is re-exported from `app.db` for use by services/routes.

## 3. Unused imports removed

- **services/medication/service.py**: Dropped unused `pymongo.MongoClient` (uses `get_db()` only).
- **services/prediction/service.py**: Dropped unused `pymongo.MongoClient` and `bson.ObjectId` (uses `get_db()` and `parse_patient_oid()`).

## Left unchanged (by design)

- **grok_engine.py**: Still used by `whatif_agent.py`; not removed or refactored.
- **load_dotenv / env parsing**: Still per-module where needed; no centralization to avoid script vs app import-order issues.
- **Prediction vs explainability vs lifestyle vs medication**: Boundaries and behavior preserved.
- **Endpoint contracts, training, artifact formats**: Not modified.

## Verification

- Linting: no new issues on touched files.
- `main.py` still uses `app.db.get_db` and `ensure_indexes`; no change.
- All Mongo access in the listed modules now goes through `get_db()`; invalid `patient_id` handling unchanged (ValueError from `parse_patient_oid` where applied).
