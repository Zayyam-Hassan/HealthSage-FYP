"""
Types and defaults for the provider-agnostic LLM layer.
"""
from __future__ import annotations

import os
from typing import Any, Callable, Dict, Optional

# Provider names supported by the client
PROVIDER_GROK = "grok"
PROVIDER_MISTRAL = "mistral"
SUPPORTED_PROVIDERS = (PROVIDER_GROK, PROVIDER_MISTRAL)

# Callback: receive a lifecycle event dict (e.g. llm_request_started, llm_request_completed).
# Used by the pipeline to log and/or stream to frontend.
LifecycleCallback = Callable[[Dict[str, Any]], None]


def default_provider() -> str:
    """Default provider when none specified (e.g. from config)."""
    p = (os.getenv("LLM_DEFAULT_PROVIDER") or "grok").strip().lower()
    return p if p in SUPPORTED_PROVIDERS else PROVIDER_GROK


def resolve_timeout_seconds(*env_names: str, default: float = 180.0) -> float:
    """Resolve a timeout from provider-specific env vars, then shared env vars, then default."""
    for env_name in (*env_names, "LLM_TIMEOUT", "LLM_TIMEOUT_SECONDS"):
        raw_value = os.getenv(env_name)
        if not raw_value:
            continue
        try:
            parsed = float(raw_value)
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            return parsed
    return default
