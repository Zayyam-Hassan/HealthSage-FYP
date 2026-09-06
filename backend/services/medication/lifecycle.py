"""
Application-level lifecycle events for the medication recommendation pipeline.
Provides consistent event payloads for pipeline, agent, and provider stages.
Frontend-friendly labels per spec.
"""
from __future__ import annotations

import datetime
from typing import Any, Callable, Dict, List, Optional

# Frontend labels for each agent (exact per spec)
AGENT_LABELS = {
    "clinical_reasoning_agent": "Analyzing patient condition",
    "medication_candidate_generator_agent": "Generating medication candidates",
    "safety_validator_agent": "Checking medication safety",
    "consensus_agent": "Preparing final recommendation",
}

PIPELINE_NAME = "medication_recommendation"


def _ts() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def _base_event(
    event_type: str,
    stage: str,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    label: str = "",
    agent: Optional[str] = None,
    provider: Optional[str] = None,
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "event_type": event_type,
        "pipeline": PIPELINE_NAME,
        "agent": agent,
        "provider": provider,
        "stage": stage,
        "label": label,
        "timestamp": _ts(),
        "request_id": request_id,
        "patient_id": patient_id,
        "duration_ms": round(duration_ms, 2) if duration_ms is not None else None,
        "error": error,
        "meta": meta or {},
    }


def pipeline_started(
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
) -> Dict[str, Any]:
    return _base_event("pipeline_started", "started", request_id=request_id, patient_id=patient_id, label="Medication recommendation started")


def pipeline_completed(
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    duration_ms: Optional[float] = None,
) -> Dict[str, Any]:
    return _base_event("pipeline_completed", "completed", request_id=request_id, patient_id=patient_id, duration_ms=duration_ms, label="Medication recommendation completed")


def pipeline_failed(
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    return _base_event("pipeline_failed", "failed", request_id=request_id, patient_id=patient_id, error=error, label="Medication recommendation failed")


def agent_started(
    agent: str,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    label = AGENT_LABELS.get(agent, agent)
    return _base_event("agent_started", "started", request_id=request_id, patient_id=patient_id, agent=agent, provider=provider, label=label)


def agent_completed(
    agent: str,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    duration_ms: Optional[float] = None,
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    label = AGENT_LABELS.get(agent, agent)
    return _base_event("agent_completed", "completed", request_id=request_id, patient_id=patient_id, agent=agent, duration_ms=duration_ms, provider=provider, label=label)


def agent_failed(
    agent: str,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    label = AGENT_LABELS.get(agent, agent)
    return _base_event("agent_failed", "failed", request_id=request_id, patient_id=patient_id, agent=agent, error=error, label=label)


def llm_fallback_started(
    provider: str,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
) -> Dict[str, Any]:
    return _base_event("llm_fallback_started", "started", request_id=request_id, patient_id=patient_id, provider=provider, label=f"Falling back to {provider}")


def llm_fallback_completed(
    provider: str,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    duration_ms: Optional[float] = None,
) -> Dict[str, Any]:
    return _base_event("llm_fallback_completed", "completed", request_id=request_id, patient_id=patient_id, provider=provider, duration_ms=duration_ms, label=f"Fallback to {provider} completed")


EventCallback = Callable[[Dict[str, Any]], None]


def emit_and_callback(event: Dict[str, Any], callback: Optional[EventCallback]) -> None:
    """Append event to a list and/or invoke callback (e.g. for SSE)."""
    if callback:
        callback(event)
