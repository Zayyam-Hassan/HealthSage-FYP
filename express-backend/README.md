## HealthSage Express Backend

This folder contains the new **Express.js + TypeScript** backend that acts as the primary application API for HealthSage. The existing **FastAPI** backend remains in place as an internal AI service for risk prediction, explainability, and recommendations.

### Tech stack

- Node.js, Express, TypeScript
- MongoDB via Mongoose
- JWT auth (`jsonwebtoken`)
- Password hashing via `bcrypt`
- `dotenv`, `cors`, `helmet`, `morgan`, `cookie-parser`
- `axios` for calling the FastAPI AI service
- `zod` for request validation

### Roles (final model, based on code)

From the existing codebase:

- Backend enum defines: `doctor`, `patient`, `admin`.
- The mobile app actively uses **`doctor`** and **`patient`** for routing and UI.
- `admin` currently has no frontend flows and is reserved for future tooling.

In Express:

- The `User` model and JWT payload support `doctor`, `patient`, and `admin`.
- Public signup only allows creating **doctor** or **patient** accounts.
- `admin` creation should be done via a separate, protected path when such requirements are defined.

### Responsibilities split

**Express (this backend)**

- Public API used by the React Native frontend (`/api/v1` prefix).
- Auth and RBAC:
  - `POST /api/v1/auth/signup`
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/me`
- Core domain models (via Mongoose):
  - Users, Patients, Doctors, Conditions, Observations, Appointments, Alerts, Reports, Conversations, Messages, Blob/file metadata, Medication catalog, Risk predictions, Analysis jobs.
- Application-layer routes (first wave implemented):
  - `/api/v1/mongo/patients` (CRUD), protected by JWT.
  - `/api/v1/risk/:patientId/explain` → proxies to FastAPI risk explain.
  - `/api/v1/risk/explain-risk` → proxies to FastAPI explain-risk.
- Orchestration of AI workflows:
  - Validates requests.
  - Calls FastAPI via `axios` (see `src/integrations/fastapi/client.ts`).
  - Will persist AI outputs into MongoDB where appropriate.

**FastAPI (existing backend, internal service)**

- Stays responsible for:
  - Risk prediction and explainability.
  - Medication recommendation.
  - Lifestyle recommendation.
  - Chatbot / agent pipelines.
- Not called directly by the frontend anymore; Express calls it using `FASTAPI_BASE_URL`.

### Structure

```text
express-backend/
  package.json
  tsconfig.json
  .env.example
  MIGRATION_PLAN.md
  src/
    app.ts
    server.ts
    config/env.ts
    db/mongoose.ts
    middlewares/
      auth.ts
      errorHandler.ts
    models/
      User.ts
      Patient.ts
      Doctor.ts
      Condition.ts
      Observation.ts
      Appointment.ts
      Alert.ts
      Report.ts
      Conversation.ts
      Message.ts
      Blob.ts
      MedicationCatalog.ts
      RiskPrediction.ts
      AnalysisJob.ts
    routes/
      health.ts
      auth.ts
      patients.ts
      risk.ts
    controllers/
      authController.ts
      patientsController.ts
      riskController.ts
    integrations/fastapi/client.ts
    types/roles.ts
    utils/jwt.ts
```

### Environment variables

Copy `.env.example` to `.env` in `express-backend/` and adjust as needed:

- `PORT` – Express port (default `9000`).
- `NODE_ENV` – `development` or `production`.
- `MONGO_URI` – MongoDB connection string (reuses the FastAPI backend convention).
- `MONGO_DB_NAME` – database name (e.g. `HealthSage_v1`).
- `JWT_SECRET` – secret used to sign JWTs.
- `JWT_EXPIRES_IN` – token lifetime (e.g. `1h`).
- `FASTAPI_BASE_URL` – base URL for FastAPI AI service (default `http://localhost:8000/api/v1`).
- `CORS_ORIGIN` – allowed origin for the frontend (e.g. `http://localhost:19006`).

### Running the Express backend

From the project root:

```bash
cd express-backend
npm install

# Development (auto-reload with ts-node-dev)
npm run dev

# Build and start (production-style)
npm run build
npm start
```

Express will:

- Connect to MongoDB using `MONGO_URI` and `MONGO_DB_NAME`.
- Listen on `PORT` (default `9000`).
- Expose health checks at:
  - `GET /health`
  - `GET /api/v1/health`

### Auth flow (frontend ↔ Express)

1. **Signup** (`POST /api/v1/auth/signup`):
   - Body: `{ email, username, password, role }` where `role` is `"doctor"` or `"patient"`.
   - Behavior:
     - Stores hashed password (bcrypt).
     - Creates user document in `users` collection.
   - Response:
     - `{ id, email, display_name, role, access_token }`.

2. **Login** (`POST /api/v1/auth/login`):
   - Body: `{ email, password }`.
   - Behavior:
     - Verifies password.
     - Updates `last_login_at`.
   - Response:
     - `{ id, email, display_name, role, access_token }`.

3. **Current user** (`GET /api/v1/auth/me`):
   - Requires `Authorization: Bearer <access_token>`.
   - Response:
     - `{ id, email, display_name, role }`.

4. **Route protection**:
   - `requireAuth` middleware validates JWT and attaches `req.user`.
   - `requireRole('doctor' | 'patient' | 'admin' | [...])` enforces role-based access.

Example:

```ts
router.get('/secure', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/admin-only', requireAuth, requireRole('admin'), handler);
```

### Frontend configuration

The React Native frontend now points to Express by default:

- `frontend/services/config.ts`:
  - `DEV_BASE_URL` is now `http://localhost:9000/api/v1` (or `http://10.0.2.2:9000/api/v1` for Android emulator).
  - `EXPO_PUBLIC_API_URL` can still override this for other environments.

Existing services like:

- `patientsService` (`/mongo/patients`)
- `aiResultsService.predictRisk` (`/risk/{id}/explain`)
- `explainRiskService.getExplainRisk` (`POST /explain-risk`)

now call Express, which in turn:

- Serves `/mongo/patients` directly from MongoDB via Mongoose.
- Proxies risk explainability calls to FastAPI via `FASTAPI_BASE_URL`.

### Notes / TODOs

- Some fields (lab tests, vitals, lifestyle, conditions arrays) are currently returned as placeholders in the Express patients controller. They should be hydrated from the appropriate collections when those flows move fully to Express.
- Additional domain routes (doctors, appointments, alerts, reports, chat, files) can be added following the same patterns used for patients and risk.

