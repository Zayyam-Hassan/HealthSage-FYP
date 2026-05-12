"""
Mistral LLM backend. Uses MISTRAL_* or LLM_* env vars.
"""
from __future__ import annotations

import os
from typing import Any, Dict

import httpx

from .base import resolve_timeout_seconds
from .concurrency import llm_sync_slot

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY") or os.getenv("LLM_API_KEY", "")
MISTRAL_BASE_URL = os.getenv("MISTRAL_BASE_URL") or os.getenv("LLM_BASE_URL", "https://api.mistral.ai/v1/chat/completions")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL") or os.getenv("LLM_MODEL", "mistral-large-latest")
MISTRAL_TIMEOUT = resolve_timeout_seconds("MISTRAL_TIMEOUT")


def call_mistral(system: str, user: str, temperature: float = 0.4) -> str:
    """Call Mistral chat completions; returns assistant message content. Raises on HTTP/API errors."""
    if not MISTRAL_API_KEY:
        raise RuntimeError("MISTRAL_API_KEY or LLM_API_KEY is not set")
    payload: Dict[str, Any] = {
        "model": MISTRAL_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
    }
    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    with llm_sync_slot():
        with httpx.Client(timeout=MISTRAL_TIMEOUT) as client:
            resp = client.post(MISTRAL_BASE_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    if "choices" in data:
        content = data["choices"][0].get("message", {}).get("content", "")
    else:
        content = data.get("message", {}).get("content", "")
    return (content or "").strip()
