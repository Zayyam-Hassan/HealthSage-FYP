"""
Process-wide limit on concurrent outbound LLM HTTP calls.

Uses a threading.Semaphore so it applies across:
- sync httpx (medication agents, Grok/Mistral clients, master agent)
- async httpx inside different asyncio.run() lifetimes (lifestyle), and uvicorn threadpool workers

Tune with LLM_MAX_CONCURRENT_REQUESTS (default 2). Increase if your provider tier allows more parallel streams.
"""
from __future__ import annotations

import asyncio
import os
import threading
from contextlib import asynccontextmanager, contextmanager

_max = max(1, int(os.getenv("LLM_MAX_CONCURRENT_REQUESTS", "2")))
_llm_semaphore = threading.Semaphore(_max)


@contextmanager
def llm_sync_slot():
    """Hold one LLM concurrency slot for synchronous code (sync httpx, etc.)."""
    _llm_semaphore.acquire()
    try:
        yield
    finally:
        _llm_semaphore.release()


@asynccontextmanager
async def llm_async_slot():
    """Hold one LLM concurrency slot from async code without blocking the event loop."""
    await asyncio.to_thread(_llm_semaphore.acquire)
    try:
        yield
    finally:
        _llm_semaphore.release()
