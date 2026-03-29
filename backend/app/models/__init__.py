# Document models: re-export from schemas (single source of truth)
from app.schemas.user import UserDoc
from app.schemas.patient import PatientDoc
from app.schemas.observation import ObservationDoc
from app.schemas.condition import ConditionDoc
from app.schemas.analysis_job import AnalysisJobDoc
from app.schemas.risk_prediction import RiskPredictionDoc
from app.schemas.lifestyle_recommendation import LifestyleRecommendationDoc
from app.schemas.medication_recommendation import MedicationRecommendationDoc
from app.schemas.conversation import ConversationDoc
from app.schemas.message import MessageDoc
from app.schemas.alert import AlertDoc
from app.schemas.blob import BlobDoc

__all__ = [
    "UserDoc",
    "PatientDoc",
    "ObservationDoc",
    "ConditionDoc",
    "AnalysisJobDoc",
    "RiskPredictionDoc",
    "LifestyleRecommendationDoc",
    "MedicationRecommendationDoc",
    "ConversationDoc",
    "MessageDoc",
    "AlertDoc",
    "BlobDoc",
]
