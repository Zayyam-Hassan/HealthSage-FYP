"""
Provider-agnostic LLM client: single generate() with Grok/Mistral, timing, and lifecycle callbacks.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

from .base import LifecycleCallback, default_provider, PROVIDER_GROK, PROVIDER_MISTRAL, SUPPORTED_PROVIDERS
from . import grok as _grok
from . import mistral as _mistral

logger = logging.getLogger(__name__)


def _emit(
    event_type: str,
    stage: str,
    provider: str,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    label: Optional[str] = None,
    duration_ms: Optional[float] = None,
    error: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a lifecycle event dict (ISO timestamp added by caller if needed)."""
    import datetime
    payload: Dict[str, Any] = {
        "event_type": event_type,
        "pipeline": "medication_recommendation",
        "provider": provider,
        "stage": stage,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "request_id": request_id,
        "patient_id": patient_id,
        "label": label or "",
        "meta": meta or {},
    }
    if duration_ms is not None:
        payload["duration_ms"] = round(duration_ms, 2)
    if error:
        payload["error"] = error
    return payload


def generate(
    system: str,
    user: str,
    provider: Optional[str] = None,
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    event_callback: Optional[LifecycleCallback] = None,
    temperature: float = 0.4,
) -> str:
    """
    Call the chosen LLM provider (Grok or Mistral). Optionally emit lifecycle events via callback.
    Returns assistant message content. Raises on API errors.
    """
    prov = (provider or default_provider()).strip().lower()
    if prov not in SUPPORTED_PROVIDERS:
        prov = PROVIDER_GROK

    def emit(stage: str, label: str = "", duration_ms: Optional[float] = None, error: Optional[str] = None, **meta: Any) -> None:
        if event_callback:
            et = f"llm_request_{stage}" if stage in ("started", "completed", "failed") else stage
            event_callback(_emit(
                et,
                stage,
                prov,
                request_id=request_id,
                patient_id=patient_id,
                label=label,
                duration_ms=duration_ms,
                error=error,
                meta=meta,
            ))

    emit("started", label=f"Calling {prov} for generation")
    start = time.perf_counter()
    try:
        if prov == PROVIDER_GROK:
            content = _grok.call_grok(system, user, temperature=temperature)
        else:
            content = _mistral.call_mistral(system, user, temperature=temperature)
        duration_ms = (time.perf_counter() - start) * 1000
        emit("completed", label=f"Calling {prov} for generation", duration_ms=duration_ms)
        logger.info(
            "llm_request_completed",
            extra={
                "request_id": request_id,
                "patient_id": patient_id,
                "provider": prov,
                "duration_ms": round(duration_ms, 2),
                "status": "ok",
            },
        )
        return content
    except Exception as e:
        duration_ms = (time.perf_counter() - start) * 1000
        err_msg = str(e)
        emit("failed", error=err_msg, duration_ms=duration_ms)
        logger.error(
            "llm_request_failed",
            extra={
                "request_id": request_id,
                "patient_id": patient_id,
                "provider": prov,
                "duration_ms": round(duration_ms, 2),
                "error": err_msg,
                "status": "failed",
            },
        )
        raise
