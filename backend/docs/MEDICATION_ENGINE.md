# Medication Recommendation Engine

Clinical decision support (CDS) for diabetes medication suggestions. **Not an autonomous prescriber**; output must always be confirmed by the clinician.

## Endpoint

- **POST** `/recommendations/medication/{patient_id}`

## Pipeline

1. **Context** – Build patient medication context from MongoDB (age, sex, BMI, HbA1c, glucose, diabetes type, GraphSAGE risk score, conditions, current medications, allergies, renal status, BP, cholesterol).
2. **Serper** – Retrieve medication guidance from trusted sources (ADA, NIH, Mayo, diabetesjournals.org, etc.).
3. **Evidence compaction** – Compress search results into a single evidence block.
4. **Grok** – Generate structured medication suggestions (primary + alternatives) with reasoning and evidence_sources.
5. **Validation** – Strict Pydantic schema; reject diagnosis/prescription language; require evidence_sources and doctor_note.
6. **Neo4j safety** – Check contraindications and drug–drug interactions (optional; if not configured, skips with no flags).
7. **Merge flags** – Set `flagged_for_review` on options that failed safety checks.
8. **Storage** – Save to `medication_recommendations` and append to `audit_logs`.
9. **Return** – JSON with primary_option, alternatives, missing_information, doctor_note, safety_flags.

## Configuration (.env)

| Variable | Purpose |
|----------|---------|
| `SERPER_API_KEY` | Web search for medication evidence |
| `GROK_API_KEY` or `LLM_API_KEY` | Grok/LLM for medication plan generation |
| `GROK_BASE_URL` or `LLM_BASE_URL` | e.g. `https://api.x.ai/v1/chat/completions` |
| `GROK_MODEL` or `LLM_MODEL` | e.g. `grok-2-latest` |
| `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` | Optional; for safety checks |

## Collections

- **medication_recommendations** – context_snapshot, retrieved_sources, evidence_block, llm_raw_output, validated_output, safety_flags, model_used, created_at.
- **audit_logs** – event, patient_id, serper_results_count, validation_passed, safety_result, recommendation_id, created_at.

## Constraints

- Engine must never say “must prescribe” or replace doctor judgment.
- Output is strict JSON; every suggestion includes reasoning and evidence_sources; doctor_note is required.
- Safety checks are applied before returning; flagged options have `flagged_for_review: true`.
