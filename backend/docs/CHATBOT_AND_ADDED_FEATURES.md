# What Was Added & Chatbot Integration

## What was added (summary)

1. **Risk layer** – `services/risk/`: prediction_service (GraphSAGE wrapper), graph_explainer (feature-importance fallback), risk_service (prediction + explanation). **APIs:** `GET /risk/{patient_id}`, `GET /risk/{patient_id}/explain`.

2. **Schemas** – `app/schemas/`: risk.py, explainability.py, chatbot.py; lifestyle_recommendation.py extended with structured response models.

3. **Agents** – `services/agents/`: LifestyleAgent, MedicationAgent, ExplainabilityAgent, WhatIfAgent, doctor_comparison, CoordinatorAgent, response_formatter, patient_context_service.

4. **Chatbot API** – `POST /chatbot/clinical-assistant` (request = ChatbotRequest, response = ChatbotResponse). **Pre-build context:** `GET /chatbot/patient-context/{patient_id}` when doctor opens chat or patient logs in.

5. **Audit** – risk_audit_logs, chatbot_audit_logs; indexes in app/db/indexes.py.

---

## Chatbot integration (no single “master prompt”)

The clinical chatbot is **not** one LLM with a master prompt. It is an **orchestration layer**:

- The **coordinator** routes by `mode` and calls **specialized services** (risk, lifestyle, medication). Each of those has its own prompts (e.g. Grok for lifestyle and medication).
- The chatbot **does not** do free-form medical chat: it returns **structured** `ChatbotResponse` with `agent_outputs` and a **formatted** `final_message` built from those outputs.

So:

- **“Master prompt”** – There is no single master prompt. The only prose the user sees is:
  - **final_message** – Built by `response_formatter.format_chatbot_response()` from risk/lifestyle/medication/explainability/comparison/whatif outputs. It summarizes risk, lifestyle categories, primary medication, safety, comparison/what-if, and always ends with a clinician-review reminder. It never says “the model is correct” or “must prescribe.”

---

## Request/response shape

**Request (POST /chatbot/clinical-assistant):**

```json
{
  "patient_id": "string",
  "doctor_query": "optional free text",
  "mode": "recommend | explain | what_if | compare",
  "doctor_assessment": {
    "diagnosis": "optional",
    "planned_medications": ["Metformin"],
    "planned_lifestyle": ["exercise advice"]
  },
  "what_if_changes": { "BMI": 27, "HbA1c": 7.1 }
}
```

**Response (ChatbotResponse):**

```json
{
  "mode": "recommend",
  "patient_id": "string",
  "agent_outputs": {
    "risk": { "risk_score", "risk_label", "explanation": { "risk_explanation", "top_features", "graph_context_summary", "method" } },
    "lifestyle": { "agent": "lifestyle", "data": { "patient_id", "context", "guidelines_used", "plan" } },
    "medication": { "agent": "medication", "data": { "primary_option", "alternatives", "safety_flags", ... } },
    "explainability": { "risk_explanation", "lifestyle_explanation", "medication_explanation", "safety_explanation", "evidence_summary", "doctor_note" },
    "comparison": { "medication_diff", "lifestyle_diff", "doctor_note" },
    "whatif": { "original_context", "modified_context", "original_outputs", "modified_outputs", "whatif_explanation" }
  },
  "final_message": "One paragraph summary for the clinician.",
  "doctor_note": "The doctor remains the final decision-maker."
}
```

Which keys appear in `agent_outputs` depends on `mode` (e.g. `whatif` only in what_if mode, `comparison` only in compare mode).

---

## Graph explainer (for risk)

- **Location:** `services/risk/graph_explainer.py` → `explain_risk_prediction(patient_id, prediction)`.

- **What it does today (fallback):**
  - Loads **feature_meta** from GraphSAGE artifacts (clinical feature names, means, stds).
  - Builds the **patient feature vector** (same as GraphSAGE input) via `_patient_data_from_mongo` and `_feature_vector_from_patient_data`.
  - Computes a **heuristic importance** per feature: `|normalized_value| * weight` (weights favor HbA1c, glucose, BMI, etc.).
  - Returns:
    - **risk_explanation** – Short text (low/medium/high) and “contributing factors”.
    - **top_features** – List of `{ "name": "HBA1C", "importance": 0.32 }`, sorted, top 8.
    - **graph_context_summary** – Generic line that prediction reflects “similarity to patient metabolic profiles”; **no real graph structure** used yet.
    - **method** – `"feature_importance"` (not GNNExplainer).

- **Future:** Replace with **GNNExplainer** (or similar) when integrated with the GraphSAGE stack; then `graph_context_summary` and possibly `top_features` can reflect true graph-based explanation.

- **Where it’s used:**
  - `get_risk_with_explanation(patient_id)` in risk_service (used by Risk tab and by the coordinator for recommend/explain/compare).
  - The **explanation** object is inside the **risk** output in `agent_outputs.risk.explanation`, and the **ExplainabilityAgent** pulls from it for **explainability_output** (risk_explanation, evidence_summary with “GraphSAGE risk prediction” and top features).

---

## Flow by mode

| Mode       | Coordinator flow |
|-----------|-------------------|
| **recommend** | get_risk_with_explanation → LifestyleAgent → MedicationAgent → ExplainabilityAgent.explain_recommendations → format_chatbot_response. |
| **explain**   | get_risk_with_explanation → ExplainabilityAgent.explain_risk; optionally lifestyle + medication → explain_recommendations → format. |
| **what_if**   | WhatIfAgent.run(patient_id, what_if_changes) → format with whatif_explanation. |
| **compare**   | get_risk_with_explanation → LifestyleAgent → MedicationAgent → compute_doctor_vs_model_diff → explain_recommendations → format. |

All important operations are logged (risk_audit_logs, chatbot_audit_logs, and existing medication/lifestyle storage).
