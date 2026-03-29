from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from app.db import get_db
from services.lifestyle.service import generate_and_store_lifestyle_recs_async


router = APIRouter(prefix="/recommendations", tags=["lifestyle"])


@router.post("/lifestyle/{patient_id}")
async def create_lifestyle_recommendations(
    patient_id: str,
    store: bool = Query(False, description="Store the generated plan in lifestyle_recommendations"),
):
    """
    Generate lifestyle recommendations for a patient.
    When store=true, persists the plan to the database and returns it with recommendation_id.
    """
    try:
        result = await generate_and_store_lifestyle_recs_async(patient_id)
        if store:
            def _store_recommendation() -> str:
                from bson import ObjectId

                db = get_db()
                oid = ObjectId(patient_id)
                doc = {
                    "patient_id": oid,
                    "plan": result.get("plan", result),
                }
                res = db.lifestyle_recommendations.insert_one(doc)
                return str(res.inserted_id)

            result["recommendation_id"] = await run_in_threadpool(_store_recommendation)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
