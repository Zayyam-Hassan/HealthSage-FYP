## HealthSage Backend Migration Plan (FastAPI → Express Orchestrator)

This document captures the step‑by‑step plan to introduce a new Express.js + TypeScript backend alongside the existing FastAPI backend, and to gradually move application‑layer responsibilities to Express while keeping AI/ML logic in FastAPI.

### 1. Current state (from code inspection)

- **Frontends**
  - React Native app under `frontend/`.
  - All HTTP calls go through `frontend/services/api.ts` using `API_BASE_URL` from `frontend/services/config.ts`.
  - `API_BASE_URL` currently points to FastAPI at `http://localhost:8000/api/v1` (or `EXPO_PUBLIC_API_URL` override).

- **FastAPI backend**
  - Lives under `backend/`.
  - Entry point: `backend/main.py`.
  - Global API prefix: `/api/v1` (`API_V1_PREFIX` constant in `main.py`).
  - Routers registered:
    - `risk_routes` (`/risk*`)
    - `compatibility_routes`
    - `explain_routes`
    - `chatbot_routes`
    - `lifestyle_routes`
    - `medication_routes`
    - `prediction_routes`
    - `mongo_routes`
    - `auth_routes`
  - MongoDB:
    - Connection via `app.db.get_db`, indexes ensured in `app.db.ensure_indexes`.
    - Config via `app.core.config` and `.env` (`MONGO_URI`, `MONGO_DB_NAME`).

- **Schemas (Pydantic)**
  - Under `backend/app/schemas/`:
    - `user.py` – `UserDoc` with fields: `email`, `display_name`, `role`, `avatar_url`, `disabled`, timestamps, `hashed_password`.
    - `enums.py` – `UserRole` (`doctor`, `patient`, `admin`) plus alert, storage, job enums.
    - Business‑domain docs: `PatientDoc`, `DoctorDoc`, `ConditionDoc`, `ObservationDoc`, `AppointmentDoc`, `AlertDoc`, `ReportDoc`, `ConversationDoc`, `MessageDoc`, `BlobDoc`, `MedicationCatalogDoc`, `RiskPredictionDoc`, `AnalysisJobDoc`, plus AI explainability / recommendation schemas.

- **Auth (FastAPI)**
  - `backend/api/auth_routes.py`:
    - `POST /auth/signup` – creates user in `users` collection, hashes password, currently accepts `role: "patient" | "doctor"` and maps to `UserRole.doctor` / `UserRole.patient`.
    - `POST /auth/login` – validates password against `users`, returns `UserPublic` (id, email, display_name, role). No JWT, FastAPI is effectively stateless for auth; frontend keeps tokenless session in storage.

- **Roles (current evidence)**
  - Backend `UserRole` enum: `doctor`, `patient`, `admin`.
  - Frontend:
    - Auth service + screens use only `'doctor' | 'patient'` to route UI flows (doctor vs patient views).
    - No direct `admin` role usage found in the mobile app yet.
  - **Decision**: Keep **`doctor`** and **`patient`** as primary roles for the mobile app; support `admin` in backend data model for future admin tooling but do not introduce new admin UI flows unless already present.

### 2. Target architecture

- **Frontend → Express only**
  - Update `API_BASE_URL` to point to the new Express backend (e.g. `:9000/api/v1`), while Express becomes the public API surface.

- **Express backend (new)**
  - New folder: `express-backend/`.
  - Tech stack: Node.js, Express, TypeScript, Mongoose, JWT, bcrypt, dotenv, cors, helmet, morgan, axios, zod, optionally cookie‑parser and multer if existing flows require them.
  - Responsibilities:
    - Auth (signup/login/logout/current user) + JWT.
    - All application CRUD and orchestration:
      - Users, patients, doctors, conditions, observations, appointments.
      - Alerts, reports, file metadata (`Blob`), medication catalog.
      - Conversations and messages (chat history).
      - Analysis job tracking, persisted risk predictions, medication and lifestyle recommendations.
    - Orchestrate AI workflows:
      - Validate requests.
      - Fetch Mongo context if needed.
      - Call FastAPI AI endpoints.
      - Persist AI outputs back to MongoDB.
      - Return normalized responses to the frontend.

- **FastAPI backend (existing, stays)**
  - Becomes **internal AI service** only.
  - Responsibilities:
    - Risk prediction (GraphSAGE/HGT, etc.).
    - Explainability.
    - Medication recommendation.
    - Lifestyle recommendation.
    - AI chatbot / agent pipelines.
  - Accessed only by Express via HTTP (axios), not directly by the frontend.

### 3. New Express backend structure (planned)

`express-backend/`

- `package.json`, `tsconfig.json`, `.env.example`, `README.md`.
- `src/`
  - `app.ts` – Express app setup (middlewares, routes).
  - `server.ts` – HTTP server bootstrap.
  - `config/` – env, logger, security config.
  - `db/` – Mongoose connection, index helpers.
  - `models/` – Mongoose models mirroring Pydantic docs:
    - `User`, `Patient`, `Doctor`, `Condition`, `Observation`, `Appointment`, `Alert`, `Report`, `Conversation`, `Message`, `Blob`, `MedicationCatalog`, `RiskPrediction`, `AnalysisJob`, etc.
  - `routes/` – top‑level routers per concern (may delegate to modules).
  - `controllers/` – route handlers.
  - `services/` – business logic, DB calls.
  - `middlewares/` – auth, error handling, validation, logging.
  - `utils/` – helpers (JWT, password, error mappers).
  - `validators/` – zod schemas per route.
  - `integrations/fastapi/` – axios client to FastAPI AI endpoints:
    - `predictRisk`, `explainRisk`, `recommendMedication`, `recommendLifestyle`, `chatbot`.
  - `modules/` – optional feature folders (auth, users, patients, doctors, analysis, etc.).

### 4. Role model (final, for now)

Based on current code:

- **Backend enum**: `UserRole = { doctor, patient, admin }`.
- **Frontend app roles**:
  - Uses `doctor` and `patient` for routing and UI decisions.
  - No active admin UI flows detected.

**Express implementation plan:**

- Support all three roles in the `User` model and JWT payload.
- For now:
  - Public signup endpoint will only allow creating `doctor` or `patient` roles (matching the current mobile UI toggle).
  - `admin` creation (if needed) should be via a protected / internal path (TODO: design when an admin UI/API exists).
- Add a short note in `express-backend/README.md` describing:
  - Roles discovered (`doctor`, `patient`, `admin`).
  - That the mobile app currently uses only `doctor` and `patient`.
  - That `admin` is reserved for future admin tooling.

### 5. Express vs FastAPI responsibility mapping

**Move to Express (new implementation, Mongo‑backed via Mongoose):**

- Auth:
  - `POST /auth/signup`
  - `POST /auth/login`
  - `GET /auth/me`
  - (Optional) `POST /auth/logout` if/when needed.
- Domain APIs (based on existing Pydantic docs and frontend usage):
  - `/patients` – CRUD for `PatientDoc`.
  - `/doctors` – CRUD / listing for `DoctorDoc` (used by doctor finder / psychiatrist screens).
  - `/appointments` – CRUD and listing for `AppointmentDoc`.
  - `/alerts` – listing and acknowledging `AlertDoc`.
  - `/reports` – listing and detail for `ReportDoc`.
  - `/observations`, `/conditions` – for clinical data where used by the UI.
  - `/files` – file metadata (`BlobDoc`), if current UI references it.
  - `/conversations`, `/messages` – chat persistence for chatbot/clinical assistant.
  - `/analysis-jobs`, `/risk-predictions`, `/recommendations` – persisted AI outputs for dashboards.

**Stay in FastAPI (called via Express):**

- `/api/v1/*` AI routes:
  - Risk prediction (`risk_routes`, `prediction_routes`).
  - Explainability (`explain_routes`, `risk_routes` explain parts).
  - Medication recommendation (`medication_routes`).
  - Lifestyle recommendation (`lifestyle_routes`).
  - Chatbot / agent orchestration (`chatbot_routes`).

Express will expose its own AI‑oriented endpoints (e.g. `/ai/risk`, `/ai/chatbot`) that:

1. Validate incoming request with zod.
2. Load any needed patient/context data from MongoDB.
3. Call the corresponding FastAPI endpoint via axios.
4. Store any relevant AI output (if the existing app expects persistence).
5. Return a normalized, frontend‑friendly response.

### 6. Migration steps (implementation order)

1. **Bootstrap Express backend**
   - Create `express-backend/` with TS + Express skeleton.
   - Add `app.ts`, `server.ts`, basic middlewares (cors, helmet, morgan, JSON).
   - Configure MongoDB connection using existing env names:
     - Prefer `MONGO_URI` / `MONGO_DB_NAME` to match FastAPI `.env`.
   - Add `/health` and `/api/v1/health` routes.

2. **Implement User model and auth in Express**
   - Mongoose `User` schema mirroring `UserDoc` (email, display_name, role, avatar_url, disabled, timestamps, hashed_password).
   - Signup:
     - Hash password with bcrypt.
     - Enforce unique `email`.
     - Restrict `role` to `doctor` or `patient` for public signup.
   - Login:
     - Validate password.
     - Issue JWT with `sub`, `role`, and basic user fields.
   - `GET /auth/me`:
     - Validate JWT.
     - Return current user shape consistent with frontend expectations.
   - Role‑based middleware:
     - `requireAuth`, `requireRole('doctor')`, `requireRole('patient')`, `requireRole('admin')`.

3. **Add Mongoose models for core domain docs**
   - Port Pydantic schemas directly to Mongoose models:
     - Patients, doctors, observations, conditions, appointments, alerts, reports, conversations, messages, blobs, medication catalog, analysis jobs, risk predictions.
   - Keep field names, optionality, and semantics identical where possible.
   - Add minimal indexes (e.g. `User.email` unique, maybe `Patient.patient_id` unique).

4. **Wire core CRUD routes needed by existing frontend**
   - Based on `frontend/services/*.ts`:
     - Implement only endpoints that are actually called.
   - Keep URL shapes and payloads compatible with existing services; if mismatch is unavoidable, adjust the service call as minimally as possible.

5. **Introduce FastAPI integration layer**
   - `src/integrations/fastapi/client.ts`:
     - Configurable `FASTAPI_BASE_URL` from env (default `http://localhost:8000/api/v1` to match current setup).
     - Helpers:
       - `callPredictRisk`, `callExplainRisk`, `callRecommendMedication`, `callRecommendLifestyle`, `callChatbot`.
   - Express AI routes use these helpers and map errors into a consistent error response model.

6. **Switch frontend to Express**
   - Update `frontend/services/config.ts`:
     - Point default `DEV_BASE_URL` to Express (e.g. `http://localhost:9000/api/v1`).
     - Keep `EXPO_PUBLIC_API_URL` override behavior intact.
   - Ensure auth and other services hit Express endpoints only.

7. **Gradually retire non‑AI endpoints in FastAPI**
   - As each feature is handled by Express and verified, mark the corresponding FastAPI route as deprecated in comments.
   - Keep FastAPI running for AI routes; do not remove any AI logic.

### 7. Env & config for Express backend

Create `express-backend/.env.example` with (names may reuse existing ones):

- `PORT=9000`
- `NODE_ENV=development`
- `MONGO_URI=mongodb://localhost:27017`
- `MONGO_DB_NAME=HealthSage_v1`
- `JWT_SECRET=change_me`
- `JWT_EXPIRES_IN=1h`
- `FASTAPI_BASE_URL=http://localhost:8000/api/v1`
- `CORS_ORIGIN=http://localhost:19006` (or mobile/web origin as needed)

### 8. Notes / open questions (to keep as TODOs)

- Admin flows:
  - No explicit admin API/UI usage was observed yet; `admin` is kept at the model level only.
  - TODO: design admin‑only endpoints and UI once requirements are clear.
- Detailed route contracts:
  - For each service (`patients`, `doctors`, `appointments`, etc.), confirm exact expected request/response shapes from `frontend/services/*.ts` before finalizing Express controllers.
  - Where ambiguity exists, keep the FastAPI implementation as reference and mirror its behavior, adding `TODO` comments in Express where deeper business rules are unclear.

