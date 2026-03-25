# HealthSage Clinician-Facing AI Orchestration Layer

## Overview

- **Risk Assessment** (separate tab): GraphSAGE-only prediction and explanation.
- **Clinical Chatbot**: Orchestrates risk, lifestyle, medication, explainability, what-if, and doctor comparison. Consumes structured outputs from services; does not perform free-form medical reasoning.

## APIs

| Endpoint | Purpose |
|----------|---------|
| **GET /risk/{patient_id}** | GraphSAGE prediction only (Risk tab) |
| **GET /risk/{patient_id}/explain** | Prediction + graph/feature explanation |
| **GET /chatbot/patient-context/{patient_id}** | **Pre-build full context** when doctor opens chatbot or patient logs in (risk + context + latest lifestyle/medication) |
| **POST /recommendations/lifestyle/{patient_id}** | Lifestyle recommendations (standalone) |
| **POST /recommendations/medication/{patient_id}** | Medication recommendations (standalone) |
| **POST /chatbot/clinical-assistant** | Main chatbot: body = `ChatbotRequest` |

## Pre-building context (doctor opens chat / patient login)

Call **GET /chatbot/patient-context/{patient_id}** when:
- A **doctor** opens the clinical chatbot for a specific patient, or
- A **patient** logs in (e.g. to show their dashboard summary).

The response includes:
- **context** – Full clinical context (age, sex, BMI, HbA1c, conditions, medications, allergies, renal, BP, cholesterol, risk_score).
- **context_summary** – Text summary for display.
- **tailoring_summary** – Clinical tailoring hint (for internal use).
- **risk_snapshot** – GraphSAGE prediction + explanation.
- **latest_lifestyle** – Most recent stored lifestyle recommendation (if any).
- **latest_medication** – Most recent medication recommendation + safety flags (if any).
- **patient_display** – full_name, age, sex for the header.

The UI can show this immediately so the clinician (or patient) sees risk and last recommendations without sending a message first.

## Chatbot Request (POST /chatbot/clinical-assistant)

```json
{
  "patient_id": "string",
  "doctor_query": "optional text",
  "mode": "recommend | explain | what_if | compare",
  "doctor_assessment": {
    "diagnosis": "optional",
    "planned_medications": [],
    "planned_lifestyle": []
  },
  "what_if_changes": { "BMI": 27, "HbA1c": 7.1 }
}
```

## Chatbot Modes

- **recommend**: Risk + lifestyle + medication + explainability; one combined message.
- **explain**: Risk explanation + optional latest lifestyle/medication + unified explanation.
- **what_if**: Run with modified context (what_if_changes); return original vs modified outputs and what-if explanation.
- **compare**: Risk + lifestyle + medication + doctor vs model diff + explainability; never ranks doctor vs model.

## Audit

- **risk_audit_logs**: patient_id, model_name, prediction_result, explanation_result, created_at.
- **chatbot_audit_logs**: patient_id, mode, request_payload, agent_outputs_keys, risk/lifestyle/medication/explainability/comparison/whatif outputs, final_message, created_at.
- **medication_recommendations** / **lifestyle** flows already store their own docs and audit.

## Constraints

- No autonomous prescribing; no “must prescribe”; no “model is correct.”
- All outputs require clinician review; doctor remains final decision-maker.
- GraphSAGE is a separate callable service and separate UI tab (risk routes).
