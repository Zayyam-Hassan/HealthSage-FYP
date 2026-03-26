from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.what_if import (
    WhatIfBaselineResponse,
    WhatIfCompareResponse,
    WhatIfScenarioRequest,
)
from services.what_if_analysis import build_baseline_response, compare_patient_scenario

router = APIRouter(prefix="/what-if", tags=["what-if"])


@router.get("/patients/{patient_id}/baseline", response_model=WhatIfBaselineResponse)
async def get_what_if_baseline(patient_id: str):
    try:
        return build_baseline_response(patient_id)
    except ValueError as e:
        detail = str(e)
        status = 422 if "Invalid" in detail or "Unsupported" in detail or "must be" in detail else 404
        raise HTTPException(status_code=status, detail=detail) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/patients/{patient_id}/compare", response_model=WhatIfCompareResponse)
async def compare_what_if_scenario(patient_id: str, payload: WhatIfScenarioRequest):
    if not payload.modifications:
        raise HTTPException(status_code=422, detail="modifications must not be empty")

    try:
        return compare_patient_scenario(
            patient_id,
            payload.modifications,
            scenario_name=payload.scenario_name,
        )
    except ValueError as e:
        detail = str(e)
        status = 422 if "Invalid" in detail or "Unsupported" in detail or "must be" in detail else 404
        raise HTTPException(status_code=status, detail=detail) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
