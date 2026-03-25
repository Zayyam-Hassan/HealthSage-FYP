"""
FastAPI routes for the medication recommendation engine.
POST /recommendations/medication/{patient_id} — multi-agent pipeline with optional body (preferred_provider, etc.).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from app.schemas.medication_recommendation import (
    MedicationRagSearchRequest,
    MedicationRagSearchResponse,
    RecommendMedicationRequest,
    RecommendMedicationResponse,
)
from services.medication.guideline_rag import (
    build_guideline_query,
    retrieve_guideline_evidence,
    summarize_guideline_influence,
)
from services.medication.rag_retriever import search_medication_knowledge
from services.medication.service import generate_patient_medication_recommendation

router = APIRouter(prefix="/recommendations", tags=["medication"])
rag_router = APIRouter(prefix="/medication-rag", tags=["medication-rag"])


@router.post("/medication/{patient_id}", response_model=RecommendMedicationResponse)
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


@rag_router.post("/search", response_model=MedicationRagSearchResponse)
async def search_medication_rag(body: MedicationRagSearchRequest):
    """Debug endpoint for the local diabetes medication RAG index."""
    try:
        results = await run_in_threadpool(
            search_medication_knowledge,
            query=body.query,
            top_k=body.top_k,
            filters=body.filters,
        )
        patient_context = body.patient_context or {}
        guideline_query = build_guideline_query(patient_context, base_query=body.query)
        guideline_results = await run_in_threadpool(
            retrieve_guideline_evidence,
            query=guideline_query,
            patient_context=patient_context,
            top_k=body.top_k,
        )
        influence_notes = summarize_guideline_influence(guideline_results)
        return MedicationRagSearchResponse(
            query=body.query,
            results=results,
            guideline_query=guideline_query,
            guideline_results=guideline_results,
            influence_notes=influence_notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail="Medication RAG index unavailable") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
