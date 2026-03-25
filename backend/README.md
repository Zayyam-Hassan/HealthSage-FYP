# HealthSage

Clinical decision support: risk prediction, explainability, lifestyle and medication recommendations, and a ChatGPT-style clinical chatbot with conversation history.

## Structure

- **`backend/`** — FastAPI app (MongoDB, risk/lifestyle/medication services, chatbot with transcript storage).
  - Run: `cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000`
  - See `backend/README.md` for API overview.
- **`frontend/`** — Expo (React Native) app; uses backend for patients, chatbot (with history), risk, and patient context.
  - Run: `cd frontend && npm install && npx expo start`
  - Set `EXPO_PUBLIC_API_URL=http://<your-ip>:8000` for physical device; default dev is `http://localhost:8000`.

## Features

- **Chat Assistant** — Single entry for risk, lifestyle, and medication: select patient, chat with persisted history (new chat / conversation list).
- **Patients** — Listed and managed via backend `/mongo/patients`.
- **Risk** — Standalone risk screen uses `GET /risk/{patient_id}`; full explanation and recommendations are available in the Chat Assistant.
