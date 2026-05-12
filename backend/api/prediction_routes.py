from fastapi import APIRouter, HTTPException, Query

from services.prediction.service import (
    predict_graphsage_patient,
    predict_graphsage_by_mongo_id,
    predict_hgt_patient,
    predict_hgt_by_mongo_id,
)


router = APIRouter(prefix="/prediction", tags=["prediction"])


@router.get("/graphsage")
def graphsage_predict(
    patient_id: str = Query(None, description="MongoDB patient ObjectId (preferred; uses Mongo + real features)"),
    patient_uri: str = Query(None, description="RDF patient URI (used when patient_id not set; TTL path)"),
    ttl_path: str = Query("output/healthsage_abox.ttl", description="Path to TTL graph (for patient_uri path)"),
):
    try:
        if patient_id:
            return predict_graphsage_by_mongo_id(patient_id)
        if patient_uri:
            return predict_graphsage_patient(patient_uri, ttl_path)
        raise HTTPException(status_code=400, detail="Provide either patient_id (Mongo) or patient_uri (TTL)")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/hgt")
def hgt_predict_endpoint(
    patient_id: str = Query(None, description="MongoDB patient ObjectId (preferred; uses Mongo + real features)"),
    patient_uri: str = Query(None, description="RDF patient URI (used when patient_id not set; TTL path)"),
    ttl_path: str = Query("output/healthsage_abox.ttl", description="Path to TTL graph (for patient_uri path)"),
):
    try:
        if patient_id:
            return predict_hgt_by_mongo_id(patient_id)
        if patient_uri:
            return predict_hgt_patient(patient_uri, ttl_path)
        raise HTTPException(status_code=400, detail="Provide either patient_id (Mongo) or patient_uri (TTL)")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
