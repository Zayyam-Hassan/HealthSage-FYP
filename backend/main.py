from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.chatbot_routes import router as chatbot_router
from api.compatibility_routes import router as compatibility_router
from api.explain_routes import router as explain_router
from api.lifestyle_routes import router as lifestyle_router
from api.medication_routes import router as medication_router, rag_router as medication_rag_router
from api.prediction_routes import router as prediction_router
from api.risk_routes import router as risk_router
from api.mongo_routes import router as mongo_router
from api.auth_routes import router as auth_router
from app.db import get_db, ensure_indexes

# Frontend expects all APIs under /api/v1 (e.g. HealthSage mobile)
API_V1_PREFIX = "/api/v1"


def _on_startup() -> None:
    """Create MongoDB indexes on app startup. Idempotent."""
    try:
        ensure_indexes(get_db())
    except Exception:
        pass  # avoid failing startup if Mongo is unavailable (e.g. dev without Mongo)


app = FastAPI()

# CORS: allow frontend (Expo / web) to call API; fixes OPTIONS 405 preflight
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_event_handler("startup", _on_startup)

app.include_router(risk_router, prefix=API_V1_PREFIX)
app.include_router(compatibility_router, prefix=API_V1_PREFIX)
app.include_router(explain_router, prefix=API_V1_PREFIX)
app.include_router(chatbot_router, prefix=API_V1_PREFIX)
app.include_router(lifestyle_router, prefix=API_V1_PREFIX)
app.include_router(medication_router, prefix=API_V1_PREFIX)
app.include_router(medication_rag_router, prefix=API_V1_PREFIX)
app.include_router(prediction_router, prefix=API_V1_PREFIX)
app.include_router(mongo_router, prefix=API_V1_PREFIX)
app.include_router(auth_router, prefix=API_V1_PREFIX)
