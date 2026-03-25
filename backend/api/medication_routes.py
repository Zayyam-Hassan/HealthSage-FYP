"""
FastAPI routes for the medication recommendation engine.
POST /recommendations/medication/{patient_id} — multi-agent pipeline with optional body (preferred_provider, etc.).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.schemas.medication_recommendation import RecommendMedicationRequest
from services.medication.service import generate_patient_medication_recommendation

router = APIRouter(prefix="/recommendations", tags=["medication"])


@router.post("/medication/{patient_id}")
async def create_medication_recommendation(
    patient_id: str,
    body: RecommendMedicationRequest | None = None,
):
    """
    Generate medication suggestions via multi-agent pipeline (clinical reasoning → candidate generator → safety validator → consensus).
    Optional body: preferred_provider (grok | mistral), risk_score override, etc.
    Returns recommended_medications, clinical_reasoning, warnings, confidence_score, agent_trace for frontend progress.
    """
    request_id = str(uuid.uuid4())
    preferred_provider = "grok"
    if body is not None and body.preferred_provider:
        p = body.preferred_provider.strip().lower()
        if p in ("grok", "mistral"):
            preferred_provider = p
    try:
        result = await run_in_threadpool(
            generate_patient_medication_recommendation,
            patient_id=patient_id,
            request_id=request_id,
            preferred_provider=preferred_provider,
            event_callback=None,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail="Service dependency unavailable") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
