"""
Grok (x.ai) LLM backend. Uses GROK_* or LLM_* env vars.
"""
from __future__ import annotations

import os
from typing import Any, Dict

import httpx

from .base import resolve_timeout_seconds

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GROK_API_KEY = os.getenv("GROK_API_KEY") or os.getenv("LLM_API_KEY", "")
GROK_BASE_URL = os.getenv("GROK_BASE_URL") or os.getenv("LLM_BASE_URL", "https://api.x.ai/v1/chat/completions")
GROK_MODEL = os.getenv("GROK_MODEL") or os.getenv("LLM_MODEL", "grok-2-latest")
GROK_TIMEOUT = resolve_timeout_seconds("GROK_TIMEOUT")


def call_grok(system: str, user: str, temperature: float = 0.4) -> str:
    """Call Grok chat completions; returns assistant message content. Raises on HTTP/API errors."""
    if not GROK_API_KEY:
        raise RuntimeError("GROK_API_KEY or LLM_API_KEY is not set")
    payload: Dict[str, Any] = {
        "model": GROK_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
    }
    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=GROK_TIMEOUT) as client:
        resp = client.post(GROK_BASE_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    if "choices" in data:
        content = data["choices"][0].get("message", {}).get("content", "")
    else:
        content = data.get("message", {}).get("content", "")
    return (content or "").strip()
