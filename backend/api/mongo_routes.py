from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from app.db import get_db
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
from app.schemas.doctor import DoctorDoc
from app.schemas.appointment import AppointmentDoc
from app.schemas.medication_catalog import MedicationCatalogDoc
from app.schemas.report_doc import ReportDoc
from app.schemas.enums import AnalysisJobStatus


router = APIRouter(prefix="/mongo", tags=["mongo"])


def _oid(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ObjectId") from None


def _limit_offset(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> Dict[str, int]:
    return {"limit": limit, "offset": offset}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.post("/users", response_model=UserDoc)
def create_user(user: UserDoc) -> UserDoc:
    db = get_db()
    payload = user.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    try:
        res = db.users.insert_one(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    doc = db.users.find_one({"_id": res.inserted_id})
    return UserDoc.model_validate(doc)


@router.get("/users", response_model=List[UserDoc])
def list_users(pagination: Dict[str, int] = _limit_offset) -> List[UserDoc]:  # type: ignore[assignment]
    db = get_db()
    cur = db.users.find().skip(pagination["offset"]).limit(pagination["limit"])
    return [UserDoc.model_validate(d) for d in cur]


@router.get("/users/{user_id}", response_model=UserDoc)
def get_user(user_id: str) -> UserDoc:
    db = get_db()
    doc = db.users.find_one({"_id": _oid(user_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return UserDoc.model_validate(doc)


@router.patch("/users/{user_id}", response_model=UserDoc)
def update_user(user_id: str, patch: Dict[str, Any]) -> UserDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.users.update_one({"_id": _oid(user_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    doc = db.users.find_one({"_id": _oid(user_id)})
    return UserDoc.model_validate(doc)


@router.delete("/users/{user_id}")
def delete_user(user_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.users.delete_one({"_id": _oid(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------


@router.post("/patients", response_model=PatientDoc)
def create_patient(patient: PatientDoc) -> PatientDoc:
    db = get_db()
    payload = patient.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.patients.insert_one(payload)
    doc = db.patients.find_one({"_id": res.inserted_id})
    return PatientDoc.model_validate(doc)


def _paginated_patients(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Paginated list for frontend. Returns { items, total, page, limit, pages }."""
    db = get_db()
    query: Dict[str, Any] = {}
    if search and search.strip():
        query["full_name"] = {"$regex": search.strip(), "$options": "i"}
    total = db.patients.count_documents(query)
    skip = (page - 1) * limit
    cur = db.patients.find(query).skip(skip).limit(limit)
    items = [PatientDoc.model_validate(d) for d in cur]
    pages = (total + limit - 1) // limit if limit else 0
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.get("/patients")
def list_patients(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
    offset: Optional[int] = Query(None, ge=0),
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> Any:
    """List patients. If page/limit provided, returns { items, total, page, limit, pages }; else list (legacy)."""
    if page is not None and limit is not None:
        return _paginated_patients(page=page, limit=limit, search=search)
    db = get_db()
    cur = db.patients.find().skip(pagination["offset"]).limit(pagination["limit"])
    return [PatientDoc.model_validate(d) for d in cur]


@router.get("/patients/{patient_id}", response_model=PatientDoc)
def get_patient(patient_id: str) -> PatientDoc:
    db = get_db()
    doc = db.patients.find_one({"_id": _oid(patient_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PatientDoc.model_validate(doc)


@router.patch("/patients/{patient_id}", response_model=PatientDoc)
def update_patient(patient_id: str, patch: Dict[str, Any]) -> PatientDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.patients.update_one({"_id": _oid(patient_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    doc = db.patients.find_one({"_id": _oid(patient_id)})
    return PatientDoc.model_validate(doc)


@router.delete("/patients/{patient_id}")
def delete_patient(patient_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.patients.delete_one({"_id": _oid(patient_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------


@router.post("/observations", response_model=ObservationDoc)
def create_observation(obs: ObservationDoc) -> ObservationDoc:
    db = get_db()
    payload = obs.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.observations.insert_one(payload)
    doc = db.observations.find_one({"_id": res.inserted_id})
    return ObservationDoc.model_validate(doc)


@router.get("/observations", response_model=List[ObservationDoc])
def list_observations(
    patient_id: Optional[str] = None,
    observation_code: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[ObservationDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    if observation_code:
        query["observation_code"] = observation_code
    cur = (
        db.observations.find(query)
        .skip(pagination["offset"])
        .limit(pagination["limit"])
    )
    return [ObservationDoc.model_validate(d) for d in cur]


@router.get("/observations/{obs_id}", response_model=ObservationDoc)
def get_observation(obs_id: str) -> ObservationDoc:
    db = get_db()
    doc = db.observations.find_one({"_id": _oid(obs_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Observation not found")
    return ObservationDoc.model_validate(doc)


@router.patch("/observations/{obs_id}", response_model=ObservationDoc)
def update_observation(obs_id: str, patch: Dict[str, Any]) -> ObservationDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.observations.update_one({"_id": _oid(obs_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Observation not found")
    doc = db.observations.find_one({"_id": _oid(obs_id)})
    return ObservationDoc.model_validate(doc)


@router.delete("/observations/{obs_id}")
def delete_observation(obs_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.observations.delete_one({"_id": _oid(obs_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Observation not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Conditions
# ---------------------------------------------------------------------------


@router.post("/conditions", response_model=ConditionDoc)
def create_condition(cond: ConditionDoc) -> ConditionDoc:
    db = get_db()
    payload = cond.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.conditions.insert_one(payload)
    doc = db.conditions.find_one({"_id": res.inserted_id})
    return ConditionDoc.model_validate(doc)


@router.get("/conditions", response_model=List[ConditionDoc])
def list_conditions(
    patient_id: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[ConditionDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    cur = db.conditions.find(query).skip(pagination["offset"]).limit(
        pagination["limit"]
    )
    return [ConditionDoc.model_validate(d) for d in cur]


@router.get("/conditions/{cond_id}", response_model=ConditionDoc)
def get_condition(cond_id: str) -> ConditionDoc:
    db = get_db()
    doc = db.conditions.find_one({"_id": _oid(cond_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Condition not found")
    return ConditionDoc.model_validate(doc)


@router.patch("/conditions/{cond_id}", response_model=ConditionDoc)
def update_condition(cond_id: str, patch: Dict[str, Any]) -> ConditionDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.conditions.update_one({"_id": _oid(cond_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Condition not found")
    doc = db.conditions.find_one({"_id": _oid(cond_id)})
    return ConditionDoc.model_validate(doc)


@router.delete("/conditions/{cond_id}")
def delete_condition(cond_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.conditions.delete_one({"_id": _oid(cond_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Condition not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Analysis jobs
# ---------------------------------------------------------------------------


@router.post("/analysis_jobs", response_model=AnalysisJobDoc)
def create_analysis_job(job: AnalysisJobDoc) -> AnalysisJobDoc:
    db = get_db()
    payload = job.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.analysis_jobs.insert_one(payload)
    doc = db.analysis_jobs.find_one({"_id": res.inserted_id})
    return AnalysisJobDoc.model_validate(doc)


@router.get("/analysis_jobs", response_model=List[AnalysisJobDoc])
def list_analysis_jobs(
    patient_id: Optional[str] = None,
    status: Optional[AnalysisJobStatus] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[AnalysisJobDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    if status:
        query["status"] = status
    cur = db.analysis_jobs.find(query).skip(pagination["offset"]).limit(
        pagination["limit"]
    )
    return [AnalysisJobDoc.model_validate(d) for d in cur]


@router.get("/analysis_jobs/{job_id}", response_model=AnalysisJobDoc)
def get_analysis_job(job_id: str) -> AnalysisJobDoc:
    db = get_db()
    doc = db.analysis_jobs.find_one({"_id": _oid(job_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    return AnalysisJobDoc.model_validate(doc)


@router.patch("/analysis_jobs/{job_id}", response_model=AnalysisJobDoc)
def update_analysis_job(job_id: str, patch: Dict[str, Any]) -> AnalysisJobDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.analysis_jobs.update_one({"_id": _oid(job_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    doc = db.analysis_jobs.find_one({"_id": _oid(job_id)})
    return AnalysisJobDoc.model_validate(doc)


@router.delete("/analysis_jobs/{job_id}")
def delete_analysis_job(job_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.analysis_jobs.delete_one({"_id": _oid(job_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Risk predictions
# ---------------------------------------------------------------------------


@router.post("/risk_predictions", response_model=RiskPredictionDoc)
def create_risk_prediction(pred: RiskPredictionDoc) -> RiskPredictionDoc:
    db = get_db()
    payload = pred.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.risk_predictions.insert_one(payload)
    doc = db.risk_predictions.find_one({"_id": res.inserted_id})
    return RiskPredictionDoc.model_validate(doc)


@router.get("/risk_predictions", response_model=List[RiskPredictionDoc])
def list_risk_predictions(
    patient_id: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[RiskPredictionDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    cur = db.risk_predictions.find(query).skip(pagination["offset"]).limit(
        pagination["limit"]
    )
    return [RiskPredictionDoc.model_validate(d) for d in cur]


@router.get("/risk_predictions/{pred_id}", response_model=RiskPredictionDoc)
def get_risk_prediction(pred_id: str) -> RiskPredictionDoc:
    db = get_db()
    doc = db.risk_predictions.find_one({"_id": _oid(pred_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return RiskPredictionDoc.model_validate(doc)


@router.patch("/risk_predictions/{pred_id}", response_model=RiskPredictionDoc)
def update_risk_prediction(pred_id: str, patch: Dict[str, Any]) -> RiskPredictionDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.risk_predictions.update_one({"_id": _oid(pred_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prediction not found")
    doc = db.risk_predictions.find_one({"_id": _oid(pred_id)})
    return RiskPredictionDoc.model_validate(doc)


@router.delete("/risk_predictions/{pred_id}")
def delete_risk_prediction(pred_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.risk_predictions.delete_one({"_id": _oid(pred_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Lifestyle recommendations
# ---------------------------------------------------------------------------


@router.post(
    "/lifestyle_recommendations",
    response_model=LifestyleRecommendationDoc,
)
def create_lifestyle_recommendation(
    rec: LifestyleRecommendationDoc,
) -> LifestyleRecommendationDoc:
    db = get_db()
    payload = rec.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.lifestyle_recommendations.insert_one(payload)
    doc = db.lifestyle_recommendations.find_one({"_id": res.inserted_id})
    return LifestyleRecommendationDoc.model_validate(doc)


@router.get(
    "/lifestyle_recommendations",
    response_model=List[LifestyleRecommendationDoc],
)
def list_lifestyle_recommendations(
    patient_id: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[LifestyleRecommendationDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    cur = db.lifestyle_recommendations.find(query).skip(
        pagination["offset"]
    ).limit(pagination["limit"])
    return [LifestyleRecommendationDoc.model_validate(d) for d in cur]


@router.get(
    "/lifestyle_recommendations/{rec_id}",
    response_model=LifestyleRecommendationDoc,
)
def get_lifestyle_recommendation(rec_id: str) -> LifestyleRecommendationDoc:
    db = get_db()
    doc = db.lifestyle_recommendations.find_one({"_id": _oid(rec_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return LifestyleRecommendationDoc.model_validate(doc)


@router.patch(
    "/lifestyle_recommendations/{rec_id}",
    response_model=LifestyleRecommendationDoc,
)
def update_lifestyle_recommendation(
    rec_id: str, patch: Dict[str, Any]
) -> LifestyleRecommendationDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.lifestyle_recommendations.update_one(
        {"_id": _oid(rec_id)}, {"$set": patch}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    doc = db.lifestyle_recommendations.find_one({"_id": _oid(rec_id)})
    return LifestyleRecommendationDoc.model_validate(doc)


@router.delete("/lifestyle_recommendations/{rec_id}")
def delete_lifestyle_recommendation(rec_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.lifestyle_recommendations.delete_one({"_id": _oid(rec_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Medication recommendations
# ---------------------------------------------------------------------------


@router.post(
    "/medication_recommendations",
    response_model=MedicationRecommendationDoc,
)
def create_medication_recommendation(
    rec: MedicationRecommendationDoc,
) -> MedicationRecommendationDoc:
    db = get_db()
    payload = rec.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.medication_recommendations.insert_one(payload)
    doc = db.medication_recommendations.find_one({"_id": res.inserted_id})
    return MedicationRecommendationDoc.model_validate(doc)


@router.get(
    "/medication_recommendations",
    response_model=List[MedicationRecommendationDoc],
)
def list_medication_recommendations(
    patient_id: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[MedicationRecommendationDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    cur = db.medication_recommendations.find(query).skip(
        pagination["offset"]
    ).limit(pagination["limit"])
    return [MedicationRecommendationDoc.model_validate(d) for d in cur]


@router.get(
    "/medication_recommendations/{rec_id}",
    response_model=MedicationRecommendationDoc,
)
def get_medication_recommendation(rec_id: str) -> MedicationRecommendationDoc:
    db = get_db()
    doc = db.medication_recommendations.find_one({"_id": _oid(rec_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return MedicationRecommendationDoc.model_validate(doc)


@router.patch(
    "/medication_recommendations/{rec_id}",
    response_model=MedicationRecommendationDoc,
)
def update_medication_recommendation(
    rec_id: str, patch: Dict[str, Any]
) -> MedicationRecommendationDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.medication_recommendations.update_one(
        {"_id": _oid(rec_id)}, {"$set": patch}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    doc = db.medication_recommendations.find_one({"_id": _oid(rec_id)})
    return MedicationRecommendationDoc.model_validate(doc)


@router.delete("/medication_recommendations/{rec_id}")
def delete_medication_recommendation(rec_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.medication_recommendations.delete_one({"_id": _oid(rec_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------


@router.post("/conversations", response_model=ConversationDoc)
def create_conversation(conv: ConversationDoc) -> ConversationDoc:
    db = get_db()
    payload = conv.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.conversations.insert_one(payload)
    doc = db.conversations.find_one({"_id": res.inserted_id})
    return ConversationDoc.model_validate(doc)


@router.get("/conversations", response_model=List[ConversationDoc])
def list_conversations(
    patient_id: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[ConversationDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    cur = db.conversations.find(query).skip(pagination["offset"]).limit(
        pagination["limit"]
    )
    return [ConversationDoc.model_validate(d) for d in cur]


@router.get("/conversations/{conv_id}", response_model=ConversationDoc)
def get_conversation(conv_id: str) -> ConversationDoc:
    db = get_db()
    doc = db.conversations.find_one({"_id": _oid(conv_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationDoc.model_validate(doc)


@router.patch("/conversations/{conv_id}", response_model=ConversationDoc)
def update_conversation(conv_id: str, patch: Dict[str, Any]) -> ConversationDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.conversations.update_one({"_id": _oid(conv_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    doc = db.conversations.find_one({"_id": _oid(conv_id)})
    return ConversationDoc.model_validate(doc)


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.conversations.delete_one({"_id": _oid(conv_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------


@router.post("/messages", response_model=MessageDoc)
def create_message(msg: MessageDoc) -> MessageDoc:
    db = get_db()
    payload = msg.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.messages.insert_one(payload)
    doc = db.messages.find_one({"_id": res.inserted_id})
    return MessageDoc.model_validate(doc)


@router.get("/messages", response_model=List[MessageDoc])
def list_messages(
    conversation_id: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[MessageDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if conversation_id:
        query["conversation_id"] = _oid(conversation_id)
    cur = db.messages.find(query).skip(pagination["offset"]).limit(
        pagination["limit"]
    )
    return [MessageDoc.model_validate(d) for d in cur]


@router.get("/messages/{msg_id}", response_model=MessageDoc)
def get_message(msg_id: str) -> MessageDoc:
    db = get_db()
    doc = db.messages.find_one({"_id": _oid(msg_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Message not found")
    return MessageDoc.model_validate(doc)


@router.delete("/messages/{msg_id}")
def delete_message(msg_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.messages.delete_one({"_id": _oid(msg_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------


@router.post("/alerts", response_model=AlertDoc)
def create_alert(alert: AlertDoc) -> AlertDoc:
    db = get_db()
    payload = alert.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.alerts.insert_one(payload)
    doc = db.alerts.find_one({"_id": res.inserted_id})
    return AlertDoc.model_validate(doc)


@router.get("/alerts", response_model=List[AlertDoc])
def list_alerts(
    patient_id: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[AlertDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    cur = db.alerts.find(query).skip(pagination["offset"]).limit(
        pagination["limit"]
    )
    return [AlertDoc.model_validate(d) for d in cur]


@router.get("/alerts/{alert_id}", response_model=AlertDoc)
def get_alert(alert_id: str) -> AlertDoc:
    db = get_db()
    doc = db.alerts.find_one({"_id": _oid(alert_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertDoc.model_validate(doc)


@router.patch("/alerts/{alert_id}", response_model=AlertDoc)
def update_alert(alert_id: str, patch: Dict[str, Any]) -> AlertDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.alerts.update_one({"_id": _oid(alert_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    doc = db.alerts.find_one({"_id": _oid(alert_id)})
    return AlertDoc.model_validate(doc)


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.alerts.delete_one({"_id": _oid(alert_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Blobs
# ---------------------------------------------------------------------------


@router.post("/blobs", response_model=BlobDoc)
def create_blob(blob: BlobDoc) -> BlobDoc:
    db = get_db()
    payload = blob.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.blobs.insert_one(payload)
    doc = db.blobs.find_one({"_id": res.inserted_id})
    return BlobDoc.model_validate(doc)


@router.get("/blobs", response_model=List[BlobDoc])
def list_blobs(
    uploaded_by: Optional[str] = None,
    pagination: Dict[str, int] = _limit_offset,  # type: ignore[assignment]
) -> List[BlobDoc]:
    db = get_db()
    query: Dict[str, Any] = {}
    if uploaded_by:
        query["uploaded_by"] = _oid(uploaded_by)
    cur = db.blobs.find(query).skip(pagination["offset"]).limit(
        pagination["limit"]
    )
    return [BlobDoc.model_validate(d) for d in cur]


@router.get("/blobs/{blob_id}", response_model=BlobDoc)
def get_blob(blob_id: str) -> BlobDoc:
    db = get_db()
    doc = db.blobs.find_one({"_id": _oid(blob_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Blob not found")
    return BlobDoc.model_validate(doc)


@router.delete("/blobs/{blob_id}")
def delete_blob(blob_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.blobs.delete_one({"_id": _oid(blob_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blob not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Doctors (frontend: psychiatrist list/detail)
# ---------------------------------------------------------------------------


def _paginated_doctors(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
) -> Dict[str, Any]:
    db = get_db()
    query: Dict[str, Any] = {}
    if search and search.strip():
        query["$or"] = [
            {"name": {"$regex": search.strip(), "$options": "i"}},
            {"specialization": {"$regex": search.strip(), "$options": "i"}},
        ]
    total = db.doctors.count_documents(query)
    skip = (page - 1) * limit
    cur = db.doctors.find(query).skip(skip).limit(limit)
    items = [DoctorDoc.model_validate(d) for d in cur]
    pages = (total + limit - 1) // limit if limit else 0
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.post("/doctors", response_model=DoctorDoc)
def create_doctor(doctor: DoctorDoc) -> DoctorDoc:
    db = get_db()
    payload = doctor.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.doctors.insert_one(payload)
    doc = db.doctors.find_one({"_id": res.inserted_id})
    return DoctorDoc.model_validate(doc)


@router.get("/doctors")
def list_doctors(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
) -> Any:
    if page is not None and limit is not None:
        return _paginated_doctors(page=page, limit=limit, search=search)
    db = get_db()
    cur = db.doctors.find().limit(100)
    return [DoctorDoc.model_validate(d) for d in cur]


@router.get("/doctors/{doctor_id}", response_model=DoctorDoc)
def get_doctor(doctor_id: str) -> DoctorDoc:
    db = get_db()
    doc = db.doctors.find_one({"_id": _oid(doctor_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return DoctorDoc.model_validate(doc)


@router.patch("/doctors/{doctor_id}", response_model=DoctorDoc)
def update_doctor(doctor_id: str, patch: Dict[str, Any]) -> DoctorDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.doctors.update_one({"_id": _oid(doctor_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doc = db.doctors.find_one({"_id": _oid(doctor_id)})
    return DoctorDoc.model_validate(doc)


@router.delete("/doctors/{doctor_id}")
def delete_doctor(doctor_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.doctors.delete_one({"_id": _oid(doctor_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------


def _paginated_appointments(
    page: int = 1,
    limit: int = 20,
    patient_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    status: Optional[str] = None,
) -> Dict[str, Any]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    if doctor_id:
        query["doctor_id"] = _oid(doctor_id)
    if status:
        query["status"] = status
    total = db.appointments.count_documents(query)
    skip = (page - 1) * limit
    cur = db.appointments.find(query).skip(skip).limit(limit)
    items = [AppointmentDoc.model_validate(d) for d in cur]
    pages = (total + limit - 1) // limit if limit else 0
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.post("/appointments", response_model=AppointmentDoc)
def create_appointment(appointment: AppointmentDoc) -> AppointmentDoc:
    db = get_db()
    payload = appointment.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    if "patient_id" in payload and isinstance(payload["patient_id"], str):
        payload["patient_id"] = _oid(payload["patient_id"])
    if "doctor_id" in payload and isinstance(payload["doctor_id"], str):
        payload["doctor_id"] = _oid(payload["doctor_id"])
    res = db.appointments.insert_one(payload)
    doc = db.appointments.find_one({"_id": res.inserted_id})
    return AppointmentDoc.model_validate(doc)


@router.get("/appointments")
def list_appointments(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    patient_id: Optional[str] = Query(None),
    doctor_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
) -> Any:
    if page is not None and limit is not None:
        return _paginated_appointments(
            page=page, limit=limit, patient_id=patient_id, doctor_id=doctor_id, status=status
        )
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    if doctor_id:
        query["doctor_id"] = _oid(doctor_id)
    if status:
        query["status"] = status
    cur = db.appointments.find(query).limit(100)
    return [AppointmentDoc.model_validate(d) for d in cur]


@router.get("/appointments/{appointment_id}", response_model=AppointmentDoc)
def get_appointment(appointment_id: str) -> AppointmentDoc:
    db = get_db()
    doc = db.appointments.find_one({"_id": _oid(appointment_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentDoc.model_validate(doc)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentDoc)
def update_appointment(appointment_id: str, patch: Dict[str, Any]) -> AppointmentDoc:
    db = get_db()
    patch.pop("_id", None)
    if "patient_id" in patch and isinstance(patch["patient_id"], str):
        patch["patient_id"] = _oid(patch["patient_id"])
    if "doctor_id" in patch and isinstance(patch["doctor_id"], str):
        patch["doctor_id"] = _oid(patch["doctor_id"])
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.appointments.update_one({"_id": _oid(appointment_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    doc = db.appointments.find_one({"_id": _oid(appointment_id)})
    return AppointmentDoc.model_validate(doc)


@router.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.appointments.delete_one({"_id": _oid(appointment_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Medications (catalog)
# ---------------------------------------------------------------------------


def _paginated_medications(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    db = get_db()
    query: Dict[str, Any] = {}
    if search and search.strip():
        query["$or"] = [
            {"name": {"$regex": search.strip(), "$options": "i"}},
            {"brand_name": {"$regex": search.strip(), "$options": "i"}},
        ]
    total = db.medications.count_documents(query)
    skip = (page - 1) * limit
    cur = db.medications.find(query).skip(skip).limit(limit)
    items = [MedicationCatalogDoc.model_validate(d) for d in cur]
    pages = (total + limit - 1) // limit if limit else 0
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.post("/medications", response_model=MedicationCatalogDoc)
def create_medication(medication: MedicationCatalogDoc) -> MedicationCatalogDoc:
    db = get_db()
    payload = medication.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    res = db.medications.insert_one(payload)
    doc = db.medications.find_one({"_id": res.inserted_id})
    return MedicationCatalogDoc.model_validate(doc)


@router.get("/medications")
def list_medications(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    search: Optional[str] = Query(None),
) -> Any:
    if page is not None and limit is not None:
        return _paginated_medications(page=page, limit=limit, search=search)
    db = get_db()
    cur = db.medications.find().limit(100)
    return [MedicationCatalogDoc.model_validate(d) for d in cur]


@router.get("/medications/{medication_id}", response_model=MedicationCatalogDoc)
def get_medication(medication_id: str) -> MedicationCatalogDoc:
    db = get_db()
    doc = db.medications.find_one({"_id": _oid(medication_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Medication not found")
    return MedicationCatalogDoc.model_validate(doc)


@router.patch("/medications/{medication_id}", response_model=MedicationCatalogDoc)
def update_medication(medication_id: str, patch: Dict[str, Any]) -> MedicationCatalogDoc:
    db = get_db()
    patch.pop("_id", None)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.medications.update_one({"_id": _oid(medication_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    doc = db.medications.find_one({"_id": _oid(medication_id)})
    return MedicationCatalogDoc.model_validate(doc)


@router.delete("/medications/{medication_id}")
def delete_medication(medication_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.medications.delete_one({"_id": _oid(medication_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medication not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


def _paginated_reports(
    page: int = 1,
    limit: int = 20,
    patient_id: Optional[str] = None,
    type_filter: Optional[str] = None,
) -> Dict[str, Any]:
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    if type_filter:
        query["type"] = type_filter
    total = db.reports.count_documents(query)
    skip = (page - 1) * limit
    cur = db.reports.find(query).skip(skip).limit(limit)
    items = [ReportDoc.model_validate(d) for d in cur]
    pages = (total + limit - 1) // limit if limit else 0
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.post("/reports", response_model=ReportDoc)
def create_report(report: ReportDoc) -> ReportDoc:
    db = get_db()
    payload = report.model_dump(by_alias=True, exclude_none=True)
    payload.pop("_id", None)
    if "patient_id" in payload and isinstance(payload["patient_id"], str):
        payload["patient_id"] = _oid(payload["patient_id"])
    res = db.reports.insert_one(payload)
    doc = db.reports.find_one({"_id": res.inserted_id})
    return ReportDoc.model_validate(doc)


@router.get("/reports")
def list_reports(
    page: Optional[int] = Query(None, ge=1),
    limit: Optional[int] = Query(None, ge=1, le=100),
    patient_id: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None, alias="type"),
) -> Any:
    if page is not None and limit is not None:
        return _paginated_reports(page=page, limit=limit, patient_id=patient_id, type_filter=report_type)
    db = get_db()
    query: Dict[str, Any] = {}
    if patient_id:
        query["patient_id"] = _oid(patient_id)
    if report_type:
        query["type"] = report_type
    cur = db.reports.find(query).limit(100)
    return [ReportDoc.model_validate(d) for d in cur]


@router.get("/reports/{report_id}", response_model=ReportDoc)
def get_report(report_id: str) -> ReportDoc:
    db = get_db()
    doc = db.reports.find_one({"_id": _oid(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportDoc.model_validate(doc)


@router.patch("/reports/{report_id}", response_model=ReportDoc)
def update_report(report_id: str, patch: Dict[str, Any]) -> ReportDoc:
    db = get_db()
    patch.pop("_id", None)
    if "patient_id" in patch and isinstance(patch["patient_id"], str):
        patch["patient_id"] = _oid(patch["patient_id"])
    if not patch:
        raise HTTPException(status_code=400, detail="Empty update")
    res = db.reports.update_one({"_id": _oid(report_id)}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    doc = db.reports.find_one({"_id": _oid(report_id)})
    return ReportDoc.model_validate(doc)


@router.delete("/reports/{report_id}")
def delete_report(report_id: str) -> Dict[str, Any]:
    db = get_db()
    res = db.reports.delete_one({"_id": _oid(report_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"deleted": True}

