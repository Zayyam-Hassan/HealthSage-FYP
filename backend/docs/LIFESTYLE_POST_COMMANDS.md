# Lifestyle recommendations – 3 POST commands

Get patient IDs first (then replace the placeholders below):

```bash
GET http://localhost:8000/mongo/patients
```

From the response, pick one `_id` per risk group (by `full_name`):

- **Healthy:** Alice Green, Bob Smith, Carol White, or David Brown  
- **Medium risk:** Eve Medium, Frank Gray, Grace Hill, or Henry Lake  
- **High risk:** Ivy High, Jack Risk, Kate Severe, or Leo Diab  

---

## 1. Healthy patient (e.g. Alice Green)

```bash
curl -X POST "http://localhost:8000/recommendations/lifestyle/HEALTHY_PATIENT_ID"
```

Replace `HEALTHY_PATIENT_ID` with the `_id` of a healthy patient (e.g. Alice Green).

---

## 2. Medium-risk patient (e.g. Eve Medium)

```bash
curl -X POST "http://localhost:8000/recommendations/lifestyle/MEDIUM_RISK_PATIENT_ID"
```

Replace `MEDIUM_RISK_PATIENT_ID` with the `_id` of a medium-risk patient (e.g. Eve Medium).

---

## 3. High-risk patient (e.g. Ivy High)

```bash
curl -X POST "http://localhost:8000/recommendations/lifestyle/HIGH_RISK_PATIENT_ID"
```

Replace `HIGH_RISK_PATIENT_ID` with the `_id` of a high-risk patient (e.g. Ivy High).

---

## Example with real IDs (yours will differ)

After running the seed once, you might have IDs like these (copy from your own `GET /mongo/patients`):

```bash
# Healthy – Alice Green
curl -X POST "http://localhost:8000/recommendations/lifestyle/69b542431e687bad9c3c0a89"

# Medium risk – Eve Medium
curl -X POST "http://localhost:8000/recommendations/lifestyle/69b542431e687bad9c3c0a8a"

# High risk – Ivy High
curl -X POST "http://localhost:8000/recommendations/lifestyle/69b542431e687bad9c3c0a8b"
```

Ensure `LLM_API_KEY` is set in `.env` or the requests will return 500.
