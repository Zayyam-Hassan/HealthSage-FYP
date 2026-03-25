# Checklist: Seed data, Mongo-backed endpoints, prediction

## Done

- [x] **Seed script** – `scripts/seed_healthsage_patients.py`  
  Inserts 4 healthy, 4 medium-risk, 4 high-risk patients + observations into MongoDB (no seed if patients already exist).

- [x] **Lifestyle context from Mongo** – `services/lifestyle/context_builder.py`  
  Builds patient context from `patients` + `observations` (by `patient_id`). Used by `POST /recommendations/lifestyle/{patient_id}`.

- [x] **Prediction: real features from Mongo** – `services/prediction/service.py`  
  - **Mongo path (faster):** `predict_graphsage_by_mongo_id(patient_id)`, `predict_hgt_by_mongo_id(patient_id)` load patient + observations from MongoDB, build the same 14 clinical features and normalization as in training (from saved `feature_meta`), run GraphSAGE/HGT.  
  - **TTL path:** `predict_graphsage_patient(patient_uri, ttl_path)` / `predict_hgt_patient(...)` still available; use when you have only RDF URI (zero-feature stub if no TTL feature pipeline).

- [x] **Prediction routes** – `api/prediction_routes.py`  
  - `GET /prediction/graphsage?patient_id=<mongo_id>` or `?patient_uri=...&ttl_path=...`  
  - `GET /prediction/hgt?patient_id=<mongo_id>` or `?patient_uri=...&ttl_path=...`  
  If `patient_id` is set, Mongo path (real features) is used; otherwise `patient_uri` + `ttl_path` use the TTL path.

- [x] **Lifestyle route** – `POST /recommendations/lifestyle/{patient_id}` uses Mongo via `build_patient_context(patient_id)`.

## How to run

1. **MongoDB** running, `MONGO_URI` / `MONGO_DB_NAME` in `.env` if needed.

2. **Seed (once):**
   ```bash
   python scripts/seed_healthsage_patients.py
   ```
   Prints patient ids per risk group. Use any of these ids for lifestyle and prediction.

3. **Backend:**
   ```bash
   uvicorn main:app --reload
   ```

4. **Example calls (use a seeded patient `_id`):**
   - Lifestyle: `POST /recommendations/lifestyle/<patient_id>`
   - GraphSAGE (Mongo): `GET /prediction/graphsage?patient_id=<patient_id>`
   - HGT (Mongo): `GET /prediction/hgt?patient_id=<patient_id>`

## Data source choice

- **Prediction:** Prefer **Mongo** when you have a Mongo `patient_id` (single patient load + real features; no TTL parse). Use **TTL** only when you have a patient URI and a TTL file (e.g. batch or legacy).
- **Neo4j:** Not wired yet. When added, you can add a `predict_*_by_neo4j_id` path and choose in the route by source param.
