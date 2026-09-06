# HealthSage MongoDB Schema (Mongo-First → Neo4j Graph)

**Data flow:** User (Doctor / Staff) → Frontend → Backend → **MongoDB** (source of truth) → sync/ETL → Neo4j (graph for analytics & GNN).

All writes go to MongoDB first. A separate sync process pushes/updates Neo4j. The schema supports the **full application**: doctors, notifications, alerts, chats (two agent types: provider + AI assistant), and blob storage (attachments, documents).

---

## 1. Data flow overview

```
┌─────────────┐     ┌──────────┐     ┌────────┐     ┌──────────┐     ┌─────────┐
│ Doctors /   │ ──► │ Frontend │ ──► │ Backend│ ──► │ MongoDB  │ ──► │ Neo4j   │
│ Staff (App) │     │          │     │        │     │ (source  │     │ (graph) │
└─────────────┘     └──────────┘     └────────┘     │  of      │     └─────────┘
       │                   │                │        │  truth)  │
       │                   └────────────────┴────────┴──────────┘
       │                                    Read path (API, notifications, chats)
       └──► Chats: Provider (human) + Assistant (AI) agents
```

- **Write path:** All app writes go to MongoDB (clinical, notifications, alerts, chat, blob metadata).
- **Read path:** Backend reads from MongoDB for API, dashboards, notifications, alerts, chats.
- **Sync:** Job/event process syncs MongoDB → Neo4j (and optionally TTL for training).

---

## 2. Collections and schema

### 2.1 Reference data (loaded once / rarely)

#### `observation_definitions`

Observation codes and metadata (maps to ontology `ObservationDefinition`).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Stable code, e.g. `"HBA1C"`, `"DIABETES_LABEL"` (use as primary key) |
| `display_name` | string | Human-readable name |
| `category` | string | `"lab"` \| `"vital"` \| `"lifestyle"` \| `"label"` \| `"demographic"` |
| `value_type` | string | `"float"` \| `"string"` \| `"integer"` |
| `unit` | string? | e.g. `"mg/dL"`, `"%"`, `"mmHg"` |
| `valid_min` | double? | Optional range |
| `valid_max` | double? | Optional range |
| `source` | string? | e.g. `"ADA-2025"` for guideline-linked codes |
| `created_at` | date | |
| `updated_at` | date | |
| `neo4j_id` | string? | Neo4j node id after sync (optional) |

**Indexes:** `_id` (unique).

---

#### `medication_knowledge` (optional)

Reference list of medications (maps to `MedicationKnowledge`).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `code` | string | e.g. RxNorm or internal code |
| `name` | string | Display name |
| `created_at` | date | |
| `neo4j_id` | string? | |

**Indexes:** `code` (unique).

---

### 2.2 Core clinical data (write path: Frontend/Backend → Mongo)

#### `patients`

One document per patient (maps to ontology `Patient`). Demographics and denormalized summary for API and sync.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Mongo primary key |
| `external_id` | string? | External system id (EHR, etc.); **unique index** |
| `age` | int? | Demographics (also in observations if encounter-level) |
| `sex` | string? | `"Male"` \| `"Female"` \| etc. |
| `height_cm` | double? | |
| `weight_kg` | double? | |
| `created_at` | date | |
| `updated_at` | date | |
| `source` | string? | e.g. `"ehr"`, `"import"` |
| **Sync** | | |
| `neo4j_id` | string? | Neo4j Patient node id after sync |
| `neo4j_synced_at` | date? | Last successful sync to Neo4j |

**Indexes:** `_id`, `external_id` (unique, sparse), `neo4j_synced_at` (for incremental sync).

**Neo4j mapping:** One `(:Patient)` node per document; properties from this doc + link to Observations/Conditions/Encounters.

---

#### `observations`

One document per observation (maps to ontology `Observation` → `instanceOf` ObservationDefinition, `valueNumeric`/`valueText`).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId | **FK → patients._id** |
| `observation_code` | string | **FK concept → observation_definitions._id** (e.g. `"HBA1C"`, `"DIABETES_LABEL"`) |
| `value_numeric` | double? | When numeric |
| `value_text` | string? | When text |
| `unit` | string? | Override or from definition |
| `effective_at` | date? | When the observation was taken (for “latest” aggregation) |
| `encounter_id` | ObjectId? | Optional link to encounter |
| `source_column` | string? | Original column/source (e.g. for imports) |
| `created_at` | date | |
| **Sync** | | |
| `neo4j_id` | string? | Neo4j Observation node id |
| `neo4j_synced_at` | date? | |

**Indexes:**
- `patient_id` + `observation_code` (+ `effective_at` desc) for “latest value per code per patient”.
- `patient_id` for “all observations for patient”.
- `observation_code` for analytics.
- `neo4j_synced_at` for incremental sync.

**Neo4j mapping:** `(:Observation)` with `observation_code`, `value_numeric`/`value_text`; `(Patient)-[:hasObservation]->(Observation)`, `(Observation)-[:instanceOf]->(ObservationDefinition)`.

---

#### `conditions`

Diagnoses / conditions (maps to ontology `Condition`).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId | **FK → patients._id** |
| `code` | string | e.g. `"Diabetes"`, `"Hypertension"` (or SNOMED/ICD if you use codes) |
| `display_name` | string? | Human-readable |
| `status` | string | `"active"` \| `"resolved"` \| `"inactive"` |
| `onset_at` | date? | |
| `resolved_at` | date? | |
| `encounter_id` | ObjectId? | Optional |
| `created_at` | date | |
| **Sync** | | |
| `neo4j_id` | string? | |
| `neo4j_synced_at` | date? | |

**Indexes:** `patient_id`, `patient_id` + `code` + `status`, `neo4j_synced_at`.

**Neo4j mapping:** `(:Condition)`; `(Patient)-[:hasCondition]->(Condition)`.

---

#### `encounters` (optional but recommended for visit-level graph)

One document per visit/encounter (maps to ontology `Encounter`).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId | **FK → patients._id** |
| `start_at` | date | |
| `end_at` | date? | |
| `type` | string? | e.g. `"outpatient"`, `"inpatient"` |
| `created_at` | date | |
| **Sync** | | |
| `neo4j_id` | string? | |
| `neo4j_synced_at` | date? | |

**Indexes:** `patient_id`, `patient_id` + `start_at`, `neo4j_synced_at`.

**Neo4j mapping:** `(Patient)-[:hasEncounter]->(Encounter)`, `(Encounter)-[:encounterHasObservation]->(Observation)` etc.

---

#### `patient_medication_events` (optional)

Medication events (maps to `PatientMedicationEvent` + `eventMedication` → MedicationKnowledge).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId | **FK → patients._id** |
| `medication_id` | ObjectId? | **FK → medication_knowledge._id** (or use `medication_code`) |
| `medication_code` | string? | If no medication_knowledge doc |
| `start_at` | date? | |
| `end_at` | date? | |
| `encounter_id` | ObjectId? | |
| `created_at` | date | |
| **Sync** | | |
| `neo4j_id` | string? | |
| `neo4j_synced_at` | date? | |

**Indexes:** `patient_id`, `neo4j_synced_at`.

**Neo4j mapping:** `(Patient)-[:hasMedicationEvent]->(PatientMedicationEvent)-[:eventMedication]->(MedicationKnowledge)`.

---

### 2.3 System outputs (Backend writes to Mongo after ML/recommendations)

#### `risk_predictions`

Diabetes (or other) risk prediction per patient (maps to ontology `RiskPrediction`).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId | **FK → patients._id** |
| `model_name` | string | e.g. `"graphsage_v2"`, `"hgt_v2"` |
| `probability` | double | 0–1 |
| `predicted_label` | int | 0 \| 1 |
| `threshold_used` | double? | |
| `created_at` | date | |
| **Sync** | | |
| `neo4j_id` | string? | |
| `neo4j_synced_at` | date? | |

**Indexes:** `patient_id` + `created_at` (desc) for “latest prediction”, `patient_id`, `neo4j_synced_at`.

**Neo4j mapping:** `(Patient)-[:hasRiskPrediction]->(RiskPrediction)`.

---

#### `lifestyle_recommendations`

Lifestyle plan from your LLM pipeline (maps to `LifestyleSuggestion` if you model it in the graph).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId | **FK → patients._id** |
| `plan` | object | `{ "diet": [...], "activity": [...], "sleep": [...], "other": [...] }` (each item `{ "text": "..." }`) |
| `context_snapshot` | object? | Patient context used for generation |
| `guidelines_used` | array? | References to guideline chunks |
| `created_at` | date | |
| **Sync** | | |
| `neo4j_id` | string? | |
| `neo4j_synced_at` | date? | |

**Indexes:** `patient_id` + `created_at` (desc), `neo4j_synced_at`.

---

#### `guideline_chunks` (reference + RAG)

For lifestyle/LLM retrieval (already used in your code).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `source` | string | e.g. `"ADA-2025"` |
| `category` | string? | e.g. `"diet"`, `"activity"` |
| `text` | string | Chunk text |
| `embedding` | array of double? | Vector for similarity search (optional) |
| `created_at` | date | |

**Indexes:** `source`, optional vector index if you use Atlas Vector Search or similar.

---

### 2.4 Optional: Audit and lineage

#### `sync_log` (optional)

Log of Mongo → Neo4j sync runs.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `target` | string | `"neo4j"` \| `"ttl"` |
| `started_at` | date | |
| `finished_at` | date? | |
| `status` | string | `"running"` \| `"success"` \| `"failed"` |
| `counts` | object? | e.g. `{ "patients": 100, "observations": 500 }` |
| `error` | string? | If failed |

---

### 2.5 Application layer: users (doctors), agents, notifications, alerts, chat, blobs

These collections support the product experience: who uses the app, in-app notifications and alerts, chat (with two agent types), and blob storage for attachments/documents.

---

#### `users` (doctors / staff)

Human users of the application (doctors, nurses, admins). Used for auth, ownership, and “who acknowledged” on alerts.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `email` | string | **Unique**; login identifier |
| `display_name` | string | |
| `role` | string | `"doctor"` \| `"nurse"` \| `"admin"` \| `"staff"` |
| `avatar_url` | string? | Optional profile image URL or blob ref |
| `created_at` | date | |
| `updated_at` | date | |
| `last_login_at` | date? | |
| `disabled` | bool? | Soft-disable account |

**Indexes:** `email` (unique), `role`, `disabled`.

---

#### `agents`

**Two agent types** that can participate in chats and other flows:

- **`provider`** – Human agent (doctor/staff). Links to a `users` document; messages “from” this agent are from that user.
- **`assistant`** – AI agent (e.g. lifestyle bot, risk explainer). No user link; identified by `assistant_id` / `model_id` for routing and prompts.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `agent_type` | string | **`"provider"`** \| **`"assistant"`** |
| `display_name` | string | e.g. `"Dr. Smith"`, `"HealthSage Lifestyle Assistant"` |
| **Provider-only** | | |
| `user_id` | ObjectId? | **FK → users._id** (only when `agent_type == "provider"`) |
| **Assistant-only** | | |
| `assistant_id` | string? | Stable id for the AI agent, e.g. `"lifestyle_bot"`, `"risk_explainer"` |
| `model_config` | object? | e.g. `{ "model": "mistral", "system_prompt_ref": "..." }` (optional) |
| **Common** | | |
| `created_at` | date | |
| `updated_at` | date | |
| `disabled` | bool? | Disable this agent |

**Indexes:** `agent_type`, `user_id` (unique, sparse), `assistant_id` (unique, sparse).

**Usage:** Resolve “who sent this message” by `sender_agent_id` → `agents` → if provider, show `user_id` (doctor); if assistant, show `display_name` / `assistant_id`.

---

#### `notifications`

In-app (and optionally push) notifications for doctors or patients (e.g. “New risk report”, “New message”, “Task assigned”).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `recipient_type` | string | `"user"` \| `"patient"` (who receives it) |
| `recipient_id` | ObjectId | **FK → users._id** or **patients._id** depending on `recipient_type` |
| `type` | string | e.g. `"risk_alert"`, `"new_message"`, `"task_assigned"`, `"lifestyle_ready"` |
| `title` | string | Short title |
| `body` | string? | Optional longer text |
| `read_at` | date? | When read (null = unread) |
| `payload` | object? | Flexible: e.g. `{ "patient_id": ..., "risk_prediction_id": ..., "conversation_id": ... }` for deep links |
| `created_at` | date | |
| `expires_at` | date? | Optional TTL for auto-cleanup |

**Indexes:** `(recipient_type, recipient_id)`, `(recipient_type, recipient_id, read_at)`, `created_at`, optional TTL on `expires_at`.

---

#### `alerts`

Clinical or system alerts that may require acknowledgment (e.g. high diabetes risk, critical lab, system failure). Often shown in a dedicated alerts list and linked to patients.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId? | **FK → patients._id** (null for system-wide alerts) |
| `severity` | string | `"critical"` \| `"high"` \| `"medium"` \| `"low"` \| `"info"` |
| `type` | string | e.g. `"clinical_risk"`, `"critical_lab"`, `"system"`, `"compliance"` |
| `title` | string | |
| `body` | string? | |
| `source_type` | string? | e.g. `"risk_prediction"`, `"observation"`, `"rule_engine"` |
| `source_id` | ObjectId? | FK to the source document (e.g. `risk_predictions._id`) |
| `acknowledged_at` | date? | When acknowledged |
| `acknowledged_by` | ObjectId? | **FK → users._id** (doctor who acknowledged) |
| `created_at` | date | |
| `expires_at` | date? | Optional |

**Indexes:** `patient_id`, `(patient_id, acknowledged_at)`, `severity`, `created_at`, optional TTL on `expires_at`.

---

#### `blobs` (blob metadata / attachments)

References to binary or large content (PDFs, images, chat attachments). Store **metadata in MongoDB**; store the actual bytes in **GridFS** (MongoDB) or **object storage** (S3, etc.). Use `blob_id` or `storage_key` in other collections to reference.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | Blob document id (use as reference in messages, etc.) |
| `storage_backend` | string | `"gridfs"` \| `"s3"` \| `"azure"` |
| `storage_key` | string | GridFS `_id` (as string) or S3 key / Azure blob path |
| `bucket` | string? | S3 bucket or container name (if applicable) |
| `filename` | string | Original filename |
| `content_type` | string | e.g. `"application/pdf"`, `"image/png"` |
| `size_bytes` | long | |
| `uploaded_by` | ObjectId? | **FK → users._id** (who uploaded) |
| `created_at` | date | |
| `checksum_sha256` | string? | Optional integrity check |

**Indexes:** `_id`, `storage_key`, `uploaded_by`, `created_at`.

**Usage:** When a chat message or form has an attachment, store `attachment_ids: [ ObjectId, ... ]` pointing to `blobs._id`; backend resolves and serves via GridFS or signed URL.

---

#### `conversations`

A chat thread (e.g. doctor–patient context, or support thread). Can be scoped to a patient or global (e.g. admin support).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `patient_id` | ObjectId? | **FK → patients._id** (optional; null for non–patient-specific threads) |
| `subject` | string? | e.g. `"Lifestyle follow-up"`, `"General"` |
| `context` | string? | e.g. `"lifestyle"`, `"risk"`, `"support"` (for routing / UI) |
| `created_at` | date | |
| `updated_at` | date | |
| `last_message_at` | date? | Denormalized for “recent” sort |

**Indexes:** `patient_id`, `(patient_id, updated_at)`, `last_message_at`.

---

#### `messages` (chat messages)

Individual messages in a conversation. **Sender is always an agent** (provider or assistant); for providers, resolve `agents.user_id` to show the doctor.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | ObjectId | |
| `conversation_id` | ObjectId | **FK → conversations._id** |
| `sender_agent_id` | ObjectId | **FK → agents._id** (provider or assistant) |
| `body` | string | Plain text or markdown content |
| `attachment_ids` | array of ObjectId? | **FK → blobs._id** (optional attachments) |
| `created_at` | date | |
| `edited_at` | date? | If edited |
| `metadata` | object? | Optional (e.g. model name for assistant replies) |

**Indexes:** `conversation_id`, `(conversation_id, created_at)`.

**Two agent types in practice:**  
- Doctor sends message → create agent with `agent_type: "provider"`, `user_id: <doctor>`; message has `sender_agent_id` = that agent.  
- AI replies → create agent with `agent_type: "assistant"`, `assistant_id: "lifestyle_bot"`; message has `sender_agent_id` = that agent.

---

## 3. Ontology / Neo4j alignment

- **Patient:** `patients` → one `(:Patient)`; properties: age, sex, heightCm, weightKg (and id mapping).
- **Observation:** `observations` → `(:Observation)` with `observationCode` (= `observation_code`), `valueNumeric`/`valueText`; `(Patient)-[:hasObservation]->(Observation)`, `(Observation)-[:instanceOf]->(ObservationDefinition)`.
- **ObservationDefinition:** `observation_definitions` → `(:ObservationDefinition)` with `obsCode` = `_id`.
- **Condition:** `conditions` → `(:Condition)`; `(Patient)-[:hasCondition]->(Condition)`.
- **Encounter:** `encounters` → `(:Encounter)`; `(Patient)-[:hasEncounter]->(Encounter)`, `(Encounter)-[:encounterHasObservation]->(Observation)` etc.
- **MedicationKnowledge / PatientMedicationEvent:** From `medication_knowledge` and `patient_medication_events`.
- **RiskPrediction / LifestyleSuggestion:** From `risk_predictions` and `lifestyle_recommendations`; link to Patient with `hasRiskPrediction` / `hasLifestyleSuggestion`.

Exclude from **training** graph (as in your GNN scripts): RiskPrediction, Explanation, LifestyleSuggestion, MedicationSuggestion, FeatureVectorSnapshot, AuditLog, GuidelineChunk and their relations. They can still exist in Neo4j for app/audit; the TTL/training pipeline filters them when building the training graph.

---

## 4. Index summary

| Collection | Recommended indexes |
|------------|----------------------|
| **Reference & clinical** | |
| `observation_definitions` | `_id` |
| `medication_knowledge` | `code` (unique) |
| `patients` | `_id`, `external_id` (unique, sparse), `neo4j_synced_at` |
| `observations` | `patient_id`, `(patient_id, observation_code, effective_at)`, `observation_code`, `neo4j_synced_at` |
| `conditions` | `patient_id`, `(patient_id, code, status)`, `neo4j_synced_at` |
| `encounters` | `patient_id`, `(patient_id, start_at)`, `neo4j_synced_at` |
| `patient_medication_events` | `patient_id`, `neo4j_synced_at` |
| **System outputs** | |
| `risk_predictions` | `patient_id`, `(patient_id, created_at)`, `neo4j_synced_at` |
| `lifestyle_recommendations` | `patient_id`, `(patient_id, created_at)`, `neo4j_synced_at` |
| `guideline_chunks` | `source`; optional vector index on `embedding` |
| **Application layer** | |
| `users` | `email` (unique), `role`, `disabled` |
| `agents` | `agent_type`, `user_id` (unique, sparse), `assistant_id` (unique, sparse) |
| `notifications` | `(recipient_type, recipient_id)`, `(recipient_type, recipient_id, read_at)`, `created_at`; optional TTL `expires_at` |
| `alerts` | `patient_id`, `(patient_id, acknowledged_at)`, `severity`, `created_at`; optional TTL `expires_at` |
| `blobs` | `_id`, `storage_key`, `uploaded_by`, `created_at` |
| `conversations` | `patient_id`, `(patient_id, updated_at)`, `last_message_at` |
| `messages` | `conversation_id`, `(conversation_id, created_at)` |
| **Audit** | |
| `sync_log` | `target`, `started_at`, `status` |

---

## 5. Sync strategy (Mongo → Neo4j)

1. **Full sync:** Query all collections; for each document with missing or stale `neo4j_synced_at`, create/update Neo4j nodes and edges; set `neo4j_id` and `neo4j_synced_at`.
2. **Incremental:** Use `neo4j_synced_at` or MongoDB Change Streams to process only new/updated documents.
3. **Order:** Sync reference data first (`observation_definitions`, `medication_knowledge`), then `patients`, then `observations`, `conditions`, `encounters`, `patient_medication_events`, then `risk_predictions` and `lifestyle_recommendations` so edges can reference existing nodes.
4. **TTL / training:** Either export from Mongo to TTL (replicating your current populate logic) or build the training graph from Neo4j and export to TTL; keep the same exclusion rules for training (no RiskPrediction, etc.).

---

## 6. Backend usage

**Clinical & ML**
- **Lifestyle service:** Read `patients` (and optionally `observations`/conditions) to build context; read `guideline_chunks` for retrieval; write result to `lifestyle_recommendations`. Optionally create a `notification` when a new plan is ready (e.g. for the doctor).
- **Prediction service:** Read patient + observations from MongoDB (or from Neo4j/TTL if you keep graph-based prediction); write result to `risk_predictions`. Optionally create an `alert` when risk is high and a `notification` for the assigned doctor.
- **Frontend/API:** Serve from MongoDB (patients, observations, conditions, risk_predictions, lifestyle_recommendations) so responses are consistent with the source of truth.

**Application layer**
- **Auth:** Resolve `users` by `email`; optionally link each doctor to a `provider` agent for chat.
- **Notifications:** Query `notifications` by `(recipient_type, recipient_id)`, filter unread (`read_at` null); mark read when user opens; use `payload` for deep links (e.g. open patient, conversation, or risk report).
- **Alerts:** List `alerts` by `patient_id` or globally; filter by `acknowledged_at` null for “pending”; on acknowledge, set `acknowledged_at` and `acknowledged_by` (current user).
- **Chat:** List `conversations` (e.g. by `patient_id`); list `messages` by `conversation_id`. For each message, resolve `sender_agent_id` → `agents`: if `agent_type == "provider"` show `users[user_id]`; if `agent_type == "assistant"` show agent `display_name`. New message from doctor: ensure a provider agent exists for that user, then insert `messages` with that `sender_agent_id`. AI reply: use the appropriate assistant agent’s `sender_agent_id` and optionally store model info in `metadata`.
- **Blobs:** On upload, write bytes to GridFS or S3; insert a `blobs` document with `storage_backend`, `storage_key`, `filename`, `content_type`, `size_bytes`, `uploaded_by`. Attach to a message by adding its `_id` to `messages.attachment_ids`. Serve download via backend (stream from GridFS or return signed URL).

This gives you a single, Mongo-first schema that supports doctors, notifications, alerts, two agent types (provider + assistant), chat, and blobs, with a clear path to Neo4j and to your existing graph-based training and prediction.
