# Medication Recommendation Pipeline — Audit and Refactor Plan

## Phase 1: Audit Deliverables

---

## Audit Deliverable 1 — Architecture Map (Touched Area)

### Route layer
- **`api/medication_routes.py`** — Single route: `POST /recommendations/medication/{patient_id}`. Calls `generate_patient_medication_recommendation(patient_id)` directly; no request body, no provider selection, no progress.
- **`api/chatbot_routes.py`** — `POST /chatbot/clinical-assistant` and `GET /chatbot/patient-context/{patient_id}`. Chat flow uses master_agent/coordinator; medication is invoked as a tool via `MedicationAgent.run(patient_id)`.

### Business logic / orchestration
- **`services/medication/service.py`** — **Current medication pipeline** (single orchestration function):
  1. `build_medication_context(patient_id)` (context_builder)
  2. `retrieve_medication_guidance(context)` + `compress_medical_evidence(serper_results)` (serper_retriever)
  3. `build_tailoring_summary(context)` (context_builder)
  4. **`generate_medication_plan(context, evidence_block, tailoring_summary)`** — Grok only (grok_engine)
  5. `validate_medication_output(llm_raw)` (validator)
  6. `check_medication_safety(context, llm_raw)` (safety_filter — Neo4j)
  7. `_merge_safety_flags(validated, safety)`
  8. Store in MongoDB + audit_logs
  9. Return dict
- **`services/agents/medication_agent.py`** — Thin wrapper: `MedicationAgent.run(patient_id)` → calls `generate_patient_medication_recommendation(patient_id)` and shapes response for coordinator/master.
- **`services/agents/master_agent.py`** — Uses `MedicationAgent` as one of several tools; has its own `_call_master_llm` (Grok-specific httpx). No shared LLM abstraction.

### LLM / provider integration
- **`services/medication/grok_engine.py`** — **Grok-only**: `GROK_API_KEY`, `GROK_BASE_URL`, `GROK_MODEL` from env; `_call_grok(system, user)` uses httpx to `GROK_BASE_URL`; `generate_medication_plan(...)` builds one big prompt and returns parsed JSON. **Prompts are inline** (SYSTEM_PROMPT, build_user_prompt).
- **`services/lifestyle/llm_engine.py`** — **Separate stack**: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (default Mistral); `_call_llm(system, user)`; different env vars than Grok. No shared abstraction.
- **Master agent** — Duplicates LLM call pattern in `master_agent.py` (MASTER_LLM_*, httpx) for tool decision and synthesize. Three distinct call sites (grok_engine, lifestyle llm_engine, master_agent) with no common interface.

### Supporting medication modules
- **`services/medication/context_builder.py`** — `build_medication_context`, `build_tailoring_summary`, `build_context_summary`; reads Mongo + optional risk score. Clear, reusable.
- **`services/medication/serper_retriever.py`** — Serper API; `retrieve_medication_guidance`, `compress_medical_evidence`. No LLM.
- **`services/medication/validator.py`** — Pydantic + forbidden/diagnosis phrase checks; validates grok_engine output. Reusable.
- **`services/medication/safety_filter.py`** — Neo4j contraindications/interactions; returns flags. Optional (graceful if no Neo4j).

### Schemas
- **`app/schemas/medication_recommendation.py`** — `EvidenceSource`, `MedicationOption`, `MedicationRecommendationOutput`. Used by validator and service. No request schema; no agent-stage schemas; no lifecycle event schema.

### Logging and observability
- **Logging**: Standard `logging` in service, grok_engine, safety_filter, serper_retriever, context_builder. Ad-hoc messages (e.g. "Medication context built", "Grok medication plan failed"); **no request_id, no structured fields, no duration_ms**.
- **Audit**: `service.py` writes one document to `audit_logs` at the end (event, patient_id, serper counts, safety result, recommendation_id). No per-stage audit; no pipeline/agent events.
- **Streaming / progress**: **None**. No SSE, no WebSocket, no callback-based progress. Frontend cannot show “Analyzing…”, “Generating candidates…”, etc.

### Where the medication pipeline logically belongs
- **Keep**: `api/medication_routes.py` as HTTP entry; `services/medication/` as the home for medication logic.
- **Extend**: `services/medication/service.py` (or a new pipeline orchestrator in the same package) to run **multi-agent stages** (clinical reasoning → candidate generation → safety validation → consensus) instead of one Grok call.
- **New/refactor**: Provider-agnostic LLM layer and lifecycle event system should live so that:
  - Medication pipeline (and optionally lifestyle/master) can call a **single LLM interface** with provider selection.
  - **Lifecycle events** can be emitted from the pipeline and, if needed, from an **SSE or callback** so the frontend can show progress.

---

## Audit Deliverable 2 — Problems and Risks

### 1. **LLM calls not abstracted**
- **grok_engine**: Direct httpx to Grok; env vars `GROK_*` / `LLM_*`. Hard-coded in medication flow.
- **lifestyle llm_engine**: Different env (`LLM_BASE_URL` etc.) and default Mistral URL.
- **master_agent**: Third copy of “post messages to chat completions” with its own env.
- **Risk**: Adding Mistral (or another provider) for medication forces edits in grok_engine and/or duplicate code. No single place for retries, timeouts, or logging.

### 2. **Prompts mixed with orchestration**
- **grok_engine**: `SYSTEM_PROMPT` and `build_user_prompt()` live next to `_call_grok` and `generate_medication_plan`. One monolithic “generate medication plan” prompt; no split for clinical reasoning vs candidates vs safety vs consensus.
- **Risk**: Multi-agent design requires separate prompts per stage; current structure would require either one huge prompt (bad) or scattering prompt logic across new files without a clear pattern.

### 3. **Single-step “pipeline”**
- Current flow is **context → Serper → one LLM call (Grok) → validate → safety (Neo4j) → store**. No distinct “clinical reasoning”, “candidate generation”, “safety validation (LLM)”, “consensus” agents; safety_filter is Neo4j-only, not an LLM safety validator.
- **Risk**: Implementing the four agents (clinical reasoning, candidate generator, safety validator agent, consensus) will require refactoring the single `generate_medication_plan` into multiple stages and reusing/adapting validator and safety_filter.

### 4. **No request tracing**
- No `request_id` (or correlation id) passed through routes → service → grok_engine. Logs and audit cannot be grouped by request.
- **Risk**: Hard to debug and monitor in production; lifecycle events would be hard to correlate.

### 5. **Weak structured logging**
- `logger.info("Medication context built for patient %s", patient_id)` — no duration, no stage name, no request_id. Exceptions logged with `logger.exception` but no structured error payload.
- **Risk**: Observability and “frontend-visible progress” require structured fields (request_id, patient_id, pipeline, agent, stage, duration_ms, status).

### 6. **No lifecycle event abstraction**
- No application-level events such as `pipeline_started`, `agent_started`, `llm_request_completed`. Audit log is a single end-of-run document.
- **Risk**: Frontend cannot show “Analyzing patient condition”, “Generating medication candidates”, etc., without adding an event mechanism and a delivery path (e.g. SSE or polling).

### 7. **Provider-specific logic in the call path**
- `service.py` imports `generate_medication_plan` from `grok_engine`; no provider parameter. “model_used”: "grok" is hard-coded in the stored document.
- **Risk**: Adding Mistral or a fallback requires changing service and grok_engine and possibly duplicating prompt logic per provider.

### 8. **API surface**
- `POST /recommendations/medication/{patient_id}` — no body; no way to pass `preferred_provider`, `risk_score` override, or future options. Chat flow only passes `patient_id` via MedicationAgent.
- **Risk**: To support “preferred_provider” or richer request payload, the route and the pipeline entry must be extended; currently no request schema.

### 9. **Unclear boundary between “safety” and “validation”**
- **validator**: Schema + forbidden/diagnosis language.
- **safety_filter**: Neo4j contraindications/interactions.
- Spec’s “Safety Validator Agent” is an **LLM** that validates candidates against context and can remove/flag. Neo4j remains a separate check. So we have two concepts: (1) LLM safety validator agent (new), (2) existing Neo4j safety_filter. Both should feed into a single “safety” view and into consensus.
- **Risk**: Naming and placement of the new “Safety Validator Agent” vs existing `safety_filter` must be clear to avoid confusion.

### 10. **Sync only**
- Routes are `async def` but `generate_patient_medication_recommendation` and all LLM calls are sync. No async/await in medication path. Acceptable for now but noted for any future async event emission or SSE.

### 11. **Schema discipline**
- Response shape is a dict built in `service.py` (patient_id, recommendation_id, primary_option, alternatives, …). No Pydantic response model for the API. Agent-stage outputs (clinical summary, candidates, validated list, consensus) have no dedicated schemas yet.
- **Risk**: Multi-agent outputs need stable contracts; adding Pydantic models per stage will improve clarity and reuse.

### 12. **Frontend progress**
- No SSE or WebSocket in the project. To show “Analyzing…”, “Generating…”, etc., we need either: (a) a new SSE endpoint that streams lifecycle events, or (b) a polling endpoint that returns status, or (c) in-memory/callback progress that the existing POST returns only at the end (no real-time progress). Minimal option for “frontend-visible” is **SSE for medication pipeline** or a **status/poll** endpoint.

---

## Audit Deliverable 3 — Refactor Plan (Before Coding)

### Goals (aligned with spec)
1. Multi-agent medication pipeline: **clinical_reasoning → medication_candidate_generation → safety_validation (LLM) → consensus**, with existing **validator** and **safety_filter** (Neo4j) integrated where appropriate.
2. Provider-agnostic LLM: one interface; Grok + Mistral; config or request-level provider selection.
3. Lifecycle events: application-level; pipeline + agent + provider; consistent payload; frontend-consumable (SSE or minimal mechanism).
4. Structured logging: request_id, patient_id, pipeline, agent, duration_ms, status.
5. Clean extension points and reuse; no full rewrite.

### Which existing files to **reuse** (with minimal or no changes)
- **`services/medication/context_builder.py`** — Keep as-is for building patient context and tailoring summary; pipeline will call it in stage 1 (clinical reasoning can use it).
- **`services/medication/serper_retriever.py`** — Keep; evidence retrieval stays; can be used by clinical reasoning and/or candidate generator.
- **`services/medication/validator.py`** — Keep; still used to validate final (or candidate) output schema and language.
- **`services/medication/safety_filter.py`** — Keep; Neo4j checks remain; Safety Validator Agent (LLM) can run before or after and merge with Neo4j flags.
- **`app/schemas/medication_recommendation.py`** — Extend with new models (see below); keep existing MedicationOption, MedicationRecommendationOutput for backward compatibility.
- **`api/medication_routes.py`** — Extend: add optional request body (e.g. preferred_provider); keep `POST /recommendations/medication/{patient_id}`; optionally add SSE endpoint for same pipeline (e.g. `GET /recommendations/medication/{patient_id}/stream` or POST with Accept: text/event-stream).
- **`services/agents/medication_agent.py`** — Keep as facade; have it call the new pipeline (so coordinator/master still get one “medication” result). Pipeline internally is multi-agent.

### Which existing files to **modify**
- **`services/medication/service.py`** — Refactor into: (1) a **pipeline orchestrator** that runs four agents in sequence, (2) each agent implemented in the same package or a new `services/medication/agents/` (or single `services/medication/pipeline.py` with agent functions). Replace single `generate_medication_plan` call with: get context → clinical_reasoning_agent → candidate_generator_agent → safety_validator_agent (LLM + Neo4j) → consensus_agent → validate final output → store. Emit lifecycle events at each step; use provider-agnostic LLM client.
- **`services/medication/grok_engine.py`** — **Do not** add Mistral here. Instead, introduce a small **provider-agnostic LLM module** (see below) and have grok_engine become one implementation of it, or deprecate direct use: pipeline and new agents call the abstraction only.

### Which **new** files are justified
1. **`app/llm/` or `services/llm/` (provider abstraction)**  
   - **`provider.py`** (or `client.py`): interface `generate(system, user, provider="grok"|"mistral", **kwargs) -> str`; implementations for Grok and Mistral using env (e.g. GROK_*, MISTRAL_*); optional retries/timeout; **emit lifecycle events** (llm_request_started, llm_request_completed, llm_request_failed, llm_fallback_started/completed).  
   - **Reuse**: grok_engine’s `_call_grok` becomes one backend; add Mistral backend. `generate_medication_plan` in grok_engine can call this abstraction with provider="grok" for backward compatibility during transition, or medication pipeline stops using grok_engine and uses the abstraction only.

2. **`services/medication/lifecycle.py`** (or `app/lifecycle.py`)**  
   - Event payload schema (Pydantic); emit functions (e.g. `emit_pipeline_started(...)`, `emit_agent_started(...)`); in-memory queue or callback list so that an SSE endpoint or the route can consume events. No dependency on FastAPI Request in core logic; the **route** or a **streaming response** can subscribe and send events to the client.

3. **`services/medication/agents/`** (or inline in pipeline)**  
   - **clinical_reasoning.py** — Input: context (from context_builder). Output: `{ clinical_summary, key_risk_factors, treatment_goals, contraindication_signals, reasoning }`. Uses LLM abstraction with a dedicated prompt.
   - **candidate_generator.py** — Input: clinical summary + treatment_goals + evidence. Output: `{ candidate_medications: [{ name, reason, priority }], generator_notes }`. Uses LLM abstraction.
   - **safety_validator_agent.py** — Input: candidates + context. Output: `{ validated_medications, removed_medications, warnings, safety_notes }`. Uses LLM + optionally Neo4j safety_filter. **Hard rule**: if this agent fails, pipeline returns degraded response (no high-confidence recommendation).
   - **consensus.py** — Input: all prior outputs. Output: `{ recommended_medications, final_reasoning, warnings, confidence_score }`. Uses LLM abstraction.
   - Prompts for each agent in same file or in **`services/medication/prompts/`** (e.g. one module with CLINICAL_REASONING_SYSTEM, CANDIDATE_GENERATOR_SYSTEM, etc.).

4. **`services/medication/pipeline.py`** (or extend service.py)**  
   - `run_medication_pipeline(patient_id, request_id=None, preferred_provider="grok", event_callback=None)` → runs agents in order; calls lifecycle.emit at each step; uses LLM abstraction; on safety validator failure, returns degraded result and logs. Returns final response dict + optional agent_trace.

5. **Schemas**  
   - **`app/schemas/medication_recommendation.py`** (extend): Add `ClinicalReasoningOutput`, `CandidateGeneratorOutput`, `SafetyValidationOutput`, `ConsensusOutput`, `MedicationLifecycleEvent`, `RecommendMedicationRequest`, `RecommendMedicationResponse` (with agent_trace, recommended_medications, clinical_reasoning, warnings, confidence_score).

6. **SSE or progress endpoint**  
   - **Option A**: New route `GET /recommendations/medication/{patient_id}/events` or POST with `Accept: text/event-stream` that runs the pipeline and streams lifecycle events as SSE.  
   - **Option B**: Single POST that returns at the end but includes `agent_trace: [{ stage, label, status, duration_ms }]` so the frontend can at least show a summary after the fact.  
   - **Recommendation**: Implement Option B first (trace in response), then add Option A (SSE) if needed, reusing the same event payload and a single subscription point in the pipeline.

### What should **remain unchanged** for now
- Chatbot routes and master_agent/coordinator **invocation** of medication (MedicationAgent.run). Only the **implementation** behind MedicationAgent changes (it calls the new pipeline).
- Lifestyle module and its LLM usage; no need to refactor lifestyle to use the new LLM abstraction in this task (can be done later).
- Neo4j safety_filter logic; only its **integration** in the pipeline (after or alongside Safety Validator Agent) is defined.
- Mongo storage shape for medication_recommendations can stay compatible; add optional `agent_trace` and `pipeline_version` to the stored doc if useful.

### Sequence of refactor + implementation
1. **Add provider-agnostic LLM layer** — New `services/llm/` (or `app/llm/`) with Grok + Mistral; single `generate(system, user, provider=...)`; env-based config; no events yet.
2. **Add lifecycle event schema and emitter** — Pydantic event model; `emit_*` functions; in-memory list or callback; no SSE yet.
3. **Add structured logging** — request_id, patient_id, pipeline, agent, duration_ms in logs; pass request_id into pipeline from route.
4. **Implement four agents** — Clinical reasoning, candidate generator, safety validator (LLM + Neo4j), consensus; each with its own prompt and LLM call via abstraction; emit agent_started/agent_completed/agent_failed; Safety Validator on failure → degraded response.
5. **Implement pipeline orchestrator** — In `service.py` or new `pipeline.py`: run agents in order; wire lifecycle; use LLM abstraction; call existing validator and safety_filter where appropriate; build final response with agent_trace.
6. **Wire MedicationAgent and route** — MedicationAgent.run calls pipeline; route optionally accepts body (preferred_provider); response includes agent_trace and new fields.
7. **Add SSE endpoint (optional)** — If event_callback can push to an async queue, add GET or POST endpoint that streams events as SSE; frontend subscribes for live labels.

### Risk notes
- **Safety validator failure**: Must not return high-confidence recommendation; pipeline must catch, log, and return a safe degraded structure (e.g. empty recommended_medications, warnings, low confidence_score).
- **Backward compatibility**: Existing `POST /recommendations/medication/{patient_id}` with no body should still work; default provider grok; response shape can be extended with optional `agent_trace` and `clinical_reasoning` etc., so existing clients that ignore new keys remain fine.
- **Import cycles**: Lifecycle module should not import from medication pipeline; pipeline imports lifecycle and llm. Keep app/llm or services/llm free of medication-specific imports.

---

## Next Step

Implementation will follow the sequence above: LLM abstraction → lifecycle → logging → four agents → pipeline → route/MedicationAgent → optional SSE.
