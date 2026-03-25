# How to Get Lifestyle Recommendations

## 1. Generate recommendations (LLM-based)

Use the **same MongoDB `patient_id`** you use for risk prediction (e.g. a seeded patient).

**Endpoint:** `POST /recommendations/lifestyle/{patient_id}`

**Example (replace with your app base URL and a real patient_id):**

```bash
# Get a patient_id from your DB (e.g. from seed)
# GET http://localhost:8000/mongo/patients  → copy one _id

# Generate lifestyle recommendations for that patient
curl -X POST "http://localhost:8000/recommendations/lifestyle/69b542431e687bad9c3c0a89"
```

**Response:** JSON with `patient_id`, `context` (demographics, BMI, HbA1c, glucose, BP, etc.), `guidelines_used`, and `plan` (diet, activity, sleep, other).

---

## 2. LLM configuration (required for generation)

The lifestyle service calls an LLM (e.g. Mistral) to generate the plan. Set in `.env`:

- **`LLM_API_KEY`** (required) – e.g. your Mistral/OpenAI API key.
- **`LLM_BASE_URL`** (optional) – defaults to `https://api.mistral.ai/v1/chat/completions`.
- **`LLM_MODEL`** (optional) – defaults to `mistral-large-latest`.

If `LLM_API_KEY` is not set, the POST will return 500 with a clear error.

---

## 2b. Web search for guidelines (optional)

To have the app **look up real guidelines from the web** (then have the LLM extract them with URLs as references), set:

- **`SERPER_API_KEY`** – your Serper API key (Google Search API). Get one at [serper.dev](https://serper.dev).

When both `SERPER_API_KEY` and `LLM_API_KEY` are set, the flow is: **web search** (ADA/diabetes guideline queries) → **LLM extracts** guidelines from the search results and attaches the **source URL** as `reference`. If `SERPER_API_KEY` is not set, the LLM uses only its own knowledge (no web lookup).

---

## 3. Stored recommendations (optional)

To **create/list/get/delete** stored recommendation documents in MongoDB:

- **Create:** `POST /mongo/lifestyle_recommendations` (body: `patient_id`, `plan`, etc.)
- **List:** `GET /mongo/lifestyle_recommendations?patient_id=...`
- **Get one:** `GET /mongo/lifestyle_recommendations/{rec_id}`
- **Delete:** `DELETE /mongo/lifestyle_recommendations/{rec_id}`

The **POST /recommendations/lifestyle/{patient_id}** flow returns the plan in the response but does not automatically write to `lifestyle_recommendations`. To persist, call the mongo create endpoint with the returned `plan` and `patient_id`.
