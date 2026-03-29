## Express Migration Gap Checklist

This file tracks what is still missing or partially migrated between FastAPI and the new Express backend, based on current frontend services and FastAPI routes.

### 1. Frontend services and expected endpoints

From `frontend/services/*.ts`:

- `auth.ts`
  - Uses:
    - `POST /auth/login`
    - `POST /auth/signup`
  - Status:
    - **OK in Express** (`/api/v1/auth/login`, `/api/v1/auth/signup` implemented).
    - **Potential enhancement**: frontend currently stores user in AsyncStorage only; `/auth/me` exists in Express for future use but is not yet used by frontend.

- `patients.ts`
  - Uses base: `/mongo/patients`
  - Endpoints:
    - `POST /mongo/patients`
    - `GET /mongo/patients?page=&limit=&search=`
    - `GET /mongo/patients/{id}`
    - `PATCH /mongo/patients/{id}`
    - `DELETE /mongo/patients/{id}`
  - Status:
    - **Express routes exist** at `/api/v1/mongo/patients` with matching verbs.
    - **Gaps/TODOs**:
      - Express `patientsController` currently returns simple placeholders for:
        - `lab_tests`
        - `vital_signs`
        - `lifestyle`
        - `conditions`
      - FastAPI `mongo_routes` previously did not fully populate these either; behavior is mostly compatible but clinical data enrichment is still TODO.

- `doctors.ts`
  - Uses base: `/mongo/doctors`
  - Endpoints:
    - `GET /mongo/doctors?page=&limit=&search=`
    - `GET /mongo/doctors/{id}`
  - Status:
    - **Missing in Express**:
      - No `doctorsRouter` or controllers yet.
      - Mongoose `Doctor` model exists.
    - **Needed**:
      - Implement Express routes + controllers that mirror FastAPI `mongo_routes` doctors section (pagination + detail).

- `appointments.ts`
  - Uses base: `/mongo/appointments`
  - Endpoints:
    - `POST /mongo/appointments`
    - `GET /mongo/appointments?patient_id=&doctor_id=&status=&page=&limit=`
    - `GET /mongo/appointments/{id}`
    - `PATCH /mongo/appointments/{id}`
    - `DELETE /mongo/appointments/{id}`
  - Status:
    - **Missing in Express**:
      - Mongoose `Appointment` model exists.
      - No Express `appointments` routes/controllers yet.

- `reports.ts`
  - Uses base: `/mongo/reports`
  - Endpoints:
    - `POST /mongo/reports`
    - `GET /mongo/reports?patient_id=&type=&page=&limit=`
    - `GET /mongo/reports/{id}`
    - `PATCH /mongo/reports/{id}`
    - `DELETE /mongo/reports/{id}`
  - Status:
    - **Missing in Express**:
      - Mongoose `Report` model exists.
      - No Express `reports` routes/controllers yet.

- `medications.ts`
  - Uses base: `/mongo/medications`
  - Endpoints:
    - `GET /mongo/medications?search=&page=&limit=`
    - `GET /mongo/medications/{id}`
  - Status:
    - **Missing in Express**:
      - Mongoose `MedicationCatalog` model exists.
      - No Express `medications` routes/controllers yet.

- `aiResults.ts`
  - Uses:
    - `GET /risk/{patient_id}/explain`
    - `GET /compatibility/{patient_id}/{medication_id}`
    - `POST /explain-risk` (body `{ patient_id, model_type }`)
  - Status:
    - **Risk explain**:
      - `GET /api/v1/risk/:patientId/explain` is implemented and proxies to FastAPI.
      - `POST /api/v1/risk/explain-risk` is implemented and proxies to FastAPI.
    - **Compatibility**:
      - `GET /compatibility/{patient_id}/{medication_id}` is still hitting the FastAPI route directly (Express has no `/compatibility` route yet).
      - Need Express AI proxy + FastAPI client helper.

- `chatbot.ts`
  - Uses:
    - `POST /chatbot/chat`
    - `GET /chatbot/patient-context/{patient_id}`
  - Status:
    - **Missing in Express**:
      - No `/api/v1/chatbot/*` routes in Express.
      - No controllers using `Conversation` / `Message` Mongoose models.

### 2. FastAPI routes and what should move to Express

From `backend/api/mongo_routes.py`:

Application-layer routes (should become Express-owned in terms of frontend exposure):

- `/mongo/users` – users CRUD
  - Currently not consumed by the mobile app; Express `User` + auth cover most needs.
  - **Checklist**:
    - No immediate Express routes required unless a UI for user admin exists.

- `/mongo/patients` – patients CRUD + paginated list
  - **Already reimplemented in Express** at `/api/v1/mongo/patients`.

- `/mongo/observations` – observations CRUD/list
  - No explicit frontend service file for observations, but might be used by dashboards or patient views indirectly.
  - **Checklist**:
    - Determine if any screen calls these endpoints directly (currently no dedicated `observations.ts` service).
    - Likely lower priority to migrate unless UI requires it.

- `/mongo/conditions` – conditions CRUD/list
  - No dedicated frontend service file; similar to observations.

- `/mongo/analysis_jobs` – analysis job tracking
  - No direct frontend service yet; may be used internally by AI flows.

- `/mongo/risk_predictions` – persisted risk predictions
  - No direct frontend service; Express owns `RiskPrediction` model but no routes yet.

- `/mongo/lifestyle_recommendations` – stored lifestyle recommendations
- `/mongo/medication_recommendations` – stored medication recommendations
  - No explicit frontend services, likely internal or future dashboards.

- `/mongo/conversations` – chat conversations
- `/mongo/messages` – chat messages
  - Chatbot service uses `/chatbot/chat` and `/chatbot/patient-context`, not these raw routes directly.
  - **Express** should handle conversation/message persistence instead of using these directly from frontend.

- `/mongo/alerts` – alerts CRUD/list
  - No dedicated `alerts.ts` service found, but might be surfaced in UI via screens.

- `/mongo/blobs` – blob/file metadata
  - No explicit frontend service.

- `/mongo/doctors` – doctors list/detail
  - **Used by frontend `doctors.ts`** and screens (psychiatrist list/detail).
  - Needs Express implementation.

- `/mongo/appointments` – appointments CRUD/list
  - **Used by `appointments.ts`**; needs Express implementation.

- `/mongo/medications` – medication catalog
  - **Used by `medications.ts`**; needs Express implementation.

- `/mongo/reports` – reports CRUD/list/detail
  - **Used by `reports.ts`**; needs Express implementation.

From `backend/api/chatbot_routes.py`:

- `/chatbot/patient-context/{patient_id}`
- `/chatbot/clinical-assistant`
- `/chatbot/chat`
- `/chatbot/conversations/{conversation_id}/transcript`

These are AI + persistence combined. For the migration:

- **AI logic & coordination** (master agent, coordinator agent, patient context service) stays in FastAPI.
- **Conversation + message persistence** should be owned by Express via Mongoose, with FastAPI called only for AI responses.
- Frontend currently uses:
  - `POST /chatbot/chat`
  - `GET /chatbot/patient-context/{patient_id}`
  - **No direct use** of `/chatbot/clinical-assistant` or `/chatbot/conversations/{id}/transcript` from `chatbot.ts`.

From `backend/api/medication_routes.py`:

- `/recommendations/medication/{patient_id}` – medication recommendation AI.
  - No dedicated frontend service file, but may be invoked via chatbot/AI flows.
  - Express should expose a proxy only if/when frontend needs standalone medication recommendations outside chatbot.

Other FastAPI routers (`risk_routes`, `explain_routes`, `lifestyle_routes`, `prediction_routes`, `compatibility_routes`) are AI-only and should remain internal behind Express proxies.

### 3. Missing Express routes / controllers (high priority)

Based on actual frontend usage:

- **Doctors**
  - `GET /api/v1/mongo/doctors?page=&limit=&search=`
  - `GET /api/v1/mongo/doctors/{id}`

- **Appointments**
  - `POST /api/v1/mongo/appointments`
  - `GET /api/v1/mongo/appointments?...`
  - `GET /api/v1/mongo/appointments/{id}`
  - `PATCH /api/v1/mongo/appointments/{id}`
  - `DELETE /api/v1/mongo/appointments/{id}`

- **Reports**
  - `POST /api/v1/mongo/reports`
  - `GET /api/v1/mongo/reports?...`
  - `GET /api/v1/mongo/reports/{id}`
  - `PATCH /api/v1/mongo/reports/{id}`
  - `DELETE /api/v1/mongo/reports/{id}`

- **Medications (catalog)**
  - `GET /api/v1/mongo/medications?...`
  - `GET /api/v1/mongo/medications/{id}`

- **Chatbot / AI chat**
  - `POST /api/v1/chatbot/chat` – should:
    - validate payload
    - create/load conversation (via Mongoose)
    - persist user message
    - call FastAPI chatbot endpoint
    - persist assistant message
    - return `ChatWithHistoryResponse` shape expected by `chatbotService`.
  - `GET /api/v1/chatbot/patient-context/{patient_id}` – should:
    - proxy directly to FastAPI `build_patient_session_context` endpoint and return the same shape.

- **Compatibility AI**
  - `GET /api/v1/compatibility/{patient_id}/{medication_id}` – proxy to FastAPI `compatibility_routes` and return `CompatibilityResponse` as used by `aiResultsService.checkCompatibility`.

### 4. FastAPI routes that should become internal-only

After Express owns application-layer responsibilities, the following FastAPI routes should no longer be called directly by the frontend (but can still be used internally if needed):

- `backend/api/mongo_routes.py`:
  - `/mongo/users*`
  - `/mongo/patients*`
  - `/mongo/observations*`
  - `/mongo/conditions*`
  - `/mongo/analysis_jobs*`
  - `/mongo/risk_predictions*`
  - `/mongo/lifestyle_recommendations*`
  - `/mongo/medication_recommendations*`
  - `/mongo/conversations*`
  - `/mongo/messages*`
  - `/mongo/alerts*`
  - `/mongo/blobs*`
  - `/mongo/doctors*`
  - `/mongo/appointments*`
  - `/mongo/medications*`
  - `/mongo/reports*`

- `backend/api/chatbot_routes.py`:
  - `/chatbot/patient-context*`
  - `/chatbot/clinical-assistant`
  - `/chatbot/chat`
  - `/chatbot/conversations/*/transcript`

These should be considered **internal** from the perspective of public API; Express will be the single entry point for app clients.

### 5. Frontend still not fully wired to Express

- All services currently use `apiClient` with `API_BASE_URL`, which now points to Express.
- However, Express does not yet implement:
  - `/mongo/doctors*`
  - `/mongo/appointments*`
  - `/mongo/reports*`
  - `/mongo/medications*`
  - `/chatbot/*`
  - `/compatibility/*`
- Once these are added in Express, **no code changes are needed in the service base paths**, only in backend implementations.

### 6. Summary of gaps to be implemented next

1. **Express domain routes/controllers to add**
   - Doctors: `src/controllers/doctorsController.ts`, `src/routes/doctors.ts`, mount at `/api/v1/mongo/doctors`.
   - Appointments: `src/controllers/appointmentsController.ts`, `src/routes/appointments.ts`, mount at `/api/v1/mongo/appointments`.
   - Reports: `src/controllers/reportsController.ts`, `src/routes/reports.ts`, mount at `/api/v1/mongo/reports`.
   - Medications (catalog): `src/controllers/medicationsController.ts`, `src/routes/medications.ts`, mount at `/api/v1/mongo/medications`.

2. **Express chatbot integration**
   - `src/controllers/chatbotController.ts`, `src/routes/chatbot.ts`, mount at `/api/v1/chatbot`.
   - Use `Conversation` and `Message` models for persistence.
   - Proxy AI logic to FastAPI via `callChatbot` and (optionally) a dedicated helper for patient context.

3. **Express compatibility AI proxy**
   - Extend `src/integrations/fastapi/client.ts` with `callCompatibility(patientId, medicationId)`.
   - New controller + route: `GET /api/v1/compatibility/:patientId/:medicationId` that returns `CompatibilityResponse`.

4. **Express wiring**
   - Mount new routers in `src/app.ts`.
   - Ensure `requireAuth` is applied to all protected routes and roles are added where clearly needed.

5. **FastAPI cleanup (doc-level)**
   - Add comments/docs marking `mongo_routes` and non-AI parts of `chatbot_routes` as internal-only.
   - Ensure frontend does not call them directly (already handled via `API_BASE_URL` pointing to Express).

