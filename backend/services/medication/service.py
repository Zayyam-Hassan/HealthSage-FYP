"""
Orchestration for the medication recommendation engine.
Supports legacy single-LLM flow and new multi-agent pipeline (clinical reasoning → candidate generator → safety validator → consensus).
"""
from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from bson import ObjectId

from app.db import get_db
from app.schemas.medication_recommendation import (
    AgentTraceEntry,
    MedicationOption,
    MedicationRecommendationOutput,
)

from .context_builder import build_context_summary, build_medication_context, build_tailoring_summary
from .safety_filter import check_medication_safety
from .serper_retriever import compress_medical_evidence, retrieve_medication_guidance
from . import lifecycle as lifecycle_events
from .agents import (
    run_clinical_reasoning,
    run_candidate_generator,
    run_safety_validator,
    run_consensus,
)

logger = logging.getLogger(__name__)


def _merge_safety_flags(
    validated: MedicationRecommendationOutput,
    safety: Dict[str, Any],
) -> MedicationRecommendationOutput:
    """Set flagged_for_review on primary/alternatives based on safety filter results."""
    primary_flags = safety.get("primary_flags") or []
    primary = validated.primary_option
    if primary_flags:
        primary = MedicationOption(
            drug_name=primary.drug_name,
            drug_class=primary.drug_class,
            why=primary.why,
            evidence_sources=primary.evidence_sources,
            confidence_note=primary.confidence_note,
            flagged_for_review=True,
        )
    alt_flags_map = {a["drug_name"]: a.get("flags") or [] for a in (safety.get("alternative_flags") or [])}
    alternatives = []
    for opt in validated.alternatives:
        flags = alt_flags_map.get(opt.drug_name) or []
        alternatives.append(
            MedicationOption(
                drug_name=opt.drug_name,
                drug_class=opt.drug_class,
                why=opt.why,
                evidence_sources=opt.evidence_sources,
                confidence_note=opt.confidence_note,
                flagged_for_review=len(flags) > 0,
            )
        )
    return MedicationRecommendationOutput(
        primary_option=primary,
        alternatives=alternatives,
        missing_information=validated.missing_information,
        doctor_note=validated.doctor_note,
    )


def run_medication_pipeline(
    patient_id: str,
    request_id: Optional[str] = None,
    preferred_provider: str = "grok",
    event_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """
    Multi-agent pipeline: clinical reasoning → candidate generator → safety validator → consensus.
    Emits lifecycle events; on safety validator failure returns degraded response (low confidence, no confident recommendation).
    """
    request_id = request_id or str(uuid.uuid4())
    events: List[Dict[str, Any]] = []

    def on_event(e: Dict[str, Any]) -> None:
        events.append(e)
        if event_callback:
            event_callback(e)

    pipeline_start = time.perf_counter()
    lifecycle_events.emit_and_callback(
        lifecycle_events.pipeline_started(request_id=request_id, patient_id=patient_id),
        on_event,
    )
    logger.info(
        "pipeline_started",
        extra={"request_id": request_id, "patient_id": patient_id, "pipeline": "medication_recommendation"},
    )

    try:
        context = build_medication_context(patient_id)
        logger.info(
            "medication_context_built",
            extra={"request_id": request_id, "patient_id": patient_id},
        )
    except Exception as e:
        logger.exception("build_medication_context failed: %s", e)
        lifecycle_events.emit_and_callback(
            lifecycle_events.pipeline_failed(request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        raise

    serper_results: List[Dict[str, Any]] = retrieve_medication_guidance(context, top_k=5)
    evidence_block = compress_medical_evidence(serper_results)

    # ----- Agent 1: Clinical Reasoning -----
    agent_name = "clinical_reasoning_agent"
    lifecycle_events.emit_and_callback(
        lifecycle_events.agent_started(agent_name, request_id=request_id, patient_id=patient_id, provider=preferred_provider),
        on_event,
    )
    t0 = time.perf_counter()
    try:
        clinical_output = run_clinical_reasoning(
            context,
            provider=preferred_provider,
            request_id=request_id,
            patient_id=patient_id,
            event_callback=on_event,
        )
        duration_ms = (time.perf_counter() - t0) * 1000
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_completed(agent_name, request_id=request_id, patient_id=patient_id, duration_ms=duration_ms, provider=preferred_provider),
            on_event,
        )
        logger.info(
            "agent_completed",
            extra={"request_id": request_id, "patient_id": patient_id, "agent": agent_name, "duration_ms": round(duration_ms, 2), "status": "ok"},
        )
    except Exception as e:
        logger.exception("clinical_reasoning_agent failed: %s", e)
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_failed(agent_name, request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        lifecycle_events.emit_and_callback(
            lifecycle_events.pipeline_failed(request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        raise

    # ----- Agent 2: Candidate Generator -----
    agent_name = "medication_candidate_generator_agent"
    lifecycle_events.emit_and_callback(
        lifecycle_events.agent_started(agent_name, request_id=request_id, patient_id=patient_id, provider=preferred_provider),
        on_event,
    )
    t0 = time.perf_counter()
    try:
        candidate_output = run_candidate_generator(
            clinical_output,
            evidence_block=evidence_block,
            provider=preferred_provider,
            request_id=request_id,
            patient_id=patient_id,
            event_callback=on_event,
        )
        duration_ms = (time.perf_counter() - t0) * 1000
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_completed(agent_name, request_id=request_id, patient_id=patient_id, duration_ms=duration_ms, provider=preferred_provider),
            on_event,
        )
        logger.info(
            "agent_completed",
            extra={"request_id": request_id, "patient_id": patient_id, "agent": agent_name, "duration_ms": round(duration_ms, 2), "status": "ok"},
        )
    except Exception as e:
        logger.exception("candidate_generator_agent failed: %s", e)
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_failed(agent_name, request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        lifecycle_events.emit_and_callback(
            lifecycle_events.pipeline_failed(request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        raise

    # ----- Agent 3: Safety Validator (hard rule: if fails, return degraded) -----
    agent_name = "safety_validator_agent"
    lifecycle_events.emit_and_callback(
        lifecycle_events.agent_started(agent_name, request_id=request_id, patient_id=patient_id, provider=preferred_provider),
        on_event,
    )
    t0 = time.perf_counter()
    safety_output = None
    try:
        ctx_with_signals = {**context, "contraindication_signals": clinical_output.contraindication_signals}
        safety_output = run_safety_validator(
            candidate_output,
            context=ctx_with_signals,
            clinical_summary=clinical_output.clinical_summary,
            provider=preferred_provider,
            request_id=request_id,
            patient_id=patient_id,
            event_callback=on_event,
        )
        duration_ms = (time.perf_counter() - t0) * 1000
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_completed(agent_name, request_id=request_id, patient_id=patient_id, duration_ms=duration_ms, provider=preferred_provider),
            on_event,
        )
        logger.info(
            "agent_completed",
            extra={"request_id": request_id, "patient_id": patient_id, "agent": agent_name, "duration_ms": round(duration_ms, 2), "status": "ok"},
        )
    except Exception as e:
        duration_ms = (time.perf_counter() - t0) * 1000
        logger.error(
            "safety_validator_agent failed; returning degraded response",
            extra={"request_id": request_id, "patient_id": patient_id, "agent": agent_name, "error": str(e), "status": "failed"},
        )
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_failed(agent_name, request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        lifecycle_events.emit_and_callback(
            lifecycle_events.pipeline_completed(request_id=request_id, patient_id=patient_id, duration_ms=(time.perf_counter() - pipeline_start) * 1000),
            on_event,
        )
        return _degraded_response(
            patient_id=patient_id,
            request_id=request_id,
            events=events,
            error=str(e),
        )

    # ----- Agent 4: Consensus -----
    agent_name = "consensus_agent"
    lifecycle_events.emit_and_callback(
        lifecycle_events.agent_started(agent_name, request_id=request_id, patient_id=patient_id, provider=preferred_provider),
        on_event,
    )
    t0 = time.perf_counter()
    try:
        consensus_output = run_consensus(
            clinical_output,
            safety_output,
            provider=preferred_provider,
            request_id=request_id,
            patient_id=patient_id,
            event_callback=on_event,
        )
        duration_ms = (time.perf_counter() - t0) * 1000
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_completed(agent_name, request_id=request_id, patient_id=patient_id, duration_ms=duration_ms, provider=preferred_provider),
            on_event,
        )
        logger.info(
            "agent_completed",
            extra={"request_id": request_id, "patient_id": patient_id, "agent": agent_name, "duration_ms": round(duration_ms, 2), "status": "ok"},
        )
    except Exception as e:
        logger.exception("consensus_agent failed: %s", e)
        lifecycle_events.emit_and_callback(
            lifecycle_events.agent_failed(agent_name, request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        lifecycle_events.emit_and_callback(
            lifecycle_events.pipeline_failed(request_id=request_id, patient_id=patient_id, error=str(e)),
            on_event,
        )
        raise

    # Neo4j safety check on recommended list (optional)
    llm_raw_for_neo4j = _consensus_to_llm_raw(consensus_output)
    neo4j_safety = check_medication_safety(context, llm_raw_for_neo4j)

    # Build response and store
    agent_trace = _events_to_trace(events)
    rec_id = _store_pipeline_result(
        patient_id=patient_id,
        context=context,
        clinical_output=clinical_output,
        candidate_output=candidate_output,
        safety_output=safety_output,
        consensus_output=consensus_output,
        neo4j_safety=neo4j_safety,
        evidence_block=evidence_block,
        serper_results=serper_results,
        provider=preferred_provider,
    )
    pipeline_duration_ms = (time.perf_counter() - pipeline_start) * 1000
    lifecycle_events.emit_and_callback(
        lifecycle_events.pipeline_completed(request_id=request_id, patient_id=patient_id, duration_ms=pipeline_duration_ms),
        on_event,
    )
    logger.info(
        "pipeline_completed",
        extra={"request_id": request_id, "patient_id": patient_id, "duration_ms": round(pipeline_duration_ms, 2), "status": "ok"},
    )

    return _build_pipeline_response(
        patient_id=patient_id,
        recommendation_id=rec_id,
        context=context,
        clinical_output=clinical_output,
        consensus_output=consensus_output,
        safety_output=safety_output,
        neo4j_safety=neo4j_safety,
        agent_trace=agent_trace,
    )


def _degraded_response(
    patient_id: str,
    request_id: str,
    events: List[Dict[str, Any]],
    error: str,
) -> Dict[str, Any]:
    """Return safe degraded response when safety validator fails."""
    trace = _events_to_trace(events)
    return {
        "patient_id": patient_id,
        "recommendation_id": None,
        "recommended_medications": [],
        "clinical_reasoning": "Safety validation could not be completed. No medication recommendation is provided.",
        "warnings": ["Safety validation could not be completed; no medication recommendation."],
        "confidence_score": 0.0,
        "agent_trace": trace,
        "primary_option": None,
        "alternatives": [],
        "missing_information": [],
        "doctor_note": "No recommendation could be generated. Clinician must decide without this decision support.",
        "safety_flags": {},
        "context_summary": None,
    }


def _consensus_to_llm_raw(consensus_output: Any) -> Dict[str, Any]:
    """Build a minimal llm_raw shape for Neo4j safety_filter (primary_option + alternatives)."""
    recs = consensus_output.recommended_medications or []
    primary = recs[0] if recs else {}
    prim = {
        "drug_name": primary.get("name", "Unknown") if isinstance(primary, dict) else str(primary),
        "drug_class": "See reasoning",
        "why": [primary.get("reason", "")] if isinstance(primary, dict) else [],
        "evidence_sources": [],
        "confidence_note": "",
        "flagged_for_review": False,
    }
    alts = []
    for r in recs[1:]:
        if isinstance(r, dict):
            alts.append({
                "drug_name": r.get("name", ""),
                "drug_class": "See reasoning",
                "why": [r.get("reason", "")],
                "evidence_sources": [],
                "confidence_note": "",
                "flagged_for_review": False,
            })
    return {
        "primary_option": prim,
        "alternatives": alts,
        "missing_information": [],
        "doctor_note": "Medication decisions must always be confirmed by the clinician.",
    }


def _events_to_trace(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert lifecycle events to agent_trace entries (label, stage, duration_ms, status)."""
    trace = []
    for e in events:
        agent = e.get("agent")
        if not agent:
            continue
        stage = e.get("stage", "")
        status = "ok" if stage == "completed" or stage == "started" else ("failed" if stage == "failed" else "ok")
        trace.append(AgentTraceEntry(
            agent=agent,
            stage=stage,
            label=e.get("label", ""),
            duration_ms=e.get("duration_ms"),
            status=status,
            error=e.get("error"),
        ).model_dump())
    return trace


def _store_pipeline_result(
    patient_id: str,
    context: Dict[str, Any],
    clinical_output: Any,
    candidate_output: Any,
    safety_output: Any,
    consensus_output: Any,
    neo4j_safety: Dict[str, Any],
    evidence_block: str,
    serper_results: List[Dict[str, Any]],
    provider: str,
) -> str:
    db = get_db()
    try:
        oid = ObjectId(patient_id)
    except Exception:
        oid = None
    llm_raw = _consensus_to_llm_raw(consensus_output)
    doc = {
        "patient_id": oid,
        "context_snapshot": context,
        "retrieved_sources": serper_results,
        "evidence_block": evidence_block,
        "clinical_reasoning": clinical_output.clinical_summary if hasattr(clinical_output, "clinical_summary") else str(clinical_output),
        "candidate_output": candidate_output.model_dump() if hasattr(candidate_output, "model_dump") else {},
        "safety_output": safety_output.model_dump() if hasattr(safety_output, "model_dump") else {},
        "consensus_output": consensus_output.model_dump() if hasattr(consensus_output, "model_dump") else {},
        "llm_raw_output": llm_raw,
        "safety_flags": neo4j_safety,
        "model_used": provider,
        "created_at": datetime.now(timezone.utc),
    }
    res = db.medication_recommendations.insert_one(doc)
    rec_id = str(res.inserted_id)
    audit = {
        "event": "medication_recommendation",
        "patient_id": patient_id,
        "pipeline": "multi_agent",
        "serper_results_count": len(serper_results),
        "safety_result": neo4j_safety,
        "recommendation_id": rec_id,
        "created_at": datetime.now(timezone.utc),
    }
    db.audit_logs.insert_one(audit)
    return rec_id


def _build_pipeline_response(
    patient_id: str,
    recommendation_id: str,
    context: Dict[str, Any],
    clinical_output: Any,
    consensus_output: Any,
    safety_output: Any,
    neo4j_safety: Dict[str, Any],
    agent_trace: List[Dict[str, Any]],
) -> Dict[str, Any]:
    recs = consensus_output.recommended_medications or []
    primary = recs[0] if recs else None
    alternatives = recs[1:] if len(recs) > 1 else []
    warnings = list(consensus_output.warnings or []) + list(safety_output.warnings or [])
    return {
        "patient_id": patient_id,
        "recommendation_id": recommendation_id,
        "recommended_medications": recs,
        "clinical_reasoning": clinical_output.clinical_summary if hasattr(clinical_output, "clinical_summary") else "",
        "warnings": warnings,
        "confidence_score": consensus_output.confidence_score,
        "agent_trace": agent_trace,
        "context_summary": build_context_summary(context),
        "primary_option": _rec_to_option(primary) if primary else None,
        "alternatives": [_rec_to_option(r) for r in alternatives],
        "missing_information": [],
        "doctor_note": "Medication decisions must always be confirmed by the clinician.",
        "safety_flags": neo4j_safety,
    }


def _rec_to_option(r: Any) -> Dict[str, Any]:
    if not isinstance(r, dict):
        return {"drug_name": str(r), "drug_class": "", "why": [], "evidence_sources": [], "confidence_note": "", "flagged_for_review": False}
    return {
        "drug_name": r.get("name", ""),
        "drug_class": r.get("drug_class", "See reasoning"),
        "why": [r.get("reason", "")] if r.get("reason") else [],
        "evidence_sources": r.get("evidence_sources", []),
        "confidence_note": r.get("confidence_note", ""),
        "flagged_for_review": bool(r.get("flagged_for_review", False)),
    }


def generate_patient_medication_recommendation(
    patient_id: str,
    request_id: Optional[str] = None,
    preferred_provider: str = "grok",
    event_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """
    Run the multi-agent medication pipeline and return structured response (with agent_trace, recommended_medications, etc.).
    """
    return run_medication_pipeline(
        patient_id=patient_id,
        request_id=request_id,
        preferred_provider=preferred_provider,
        event_callback=event_callback,
    )
