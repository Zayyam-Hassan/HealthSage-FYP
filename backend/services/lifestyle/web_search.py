"""
Web search for guideline retrieval. Uses Serper (Google Search API).
Set SERPER_API_KEY in .env to enable. https://serper.dev
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, List

import httpx

from .async_utils import run_coro_sync

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
SERPER_URL = "https://google.serper.dev/search"
SERPER_TIMEOUT = float(os.getenv("SERPER_TIMEOUT", "15"))
TRUSTED_DOMAINS = (
    "diabetesjournals.org",
    "diabetes.org",
    "nih.gov",
    "niddk.nih.gov",
    "cdc.gov",
    "heart.org",
    "mayoclinic.org",
)


def _normalize_results(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    organic = data.get("organic") or []
    return [
        {
            "title": item.get("title", ""),
            "link": item.get("link", ""),
            "snippet": item.get("snippet", ""),
        }
        for item in organic
        if item.get("link")
    ]


def _is_trusted(link: str) -> bool:
    link_lower = (link or "").lower()
    return any(domain in link_lower for domain in TRUSTED_DOMAINS)


async def search_web_async(
    query: str,
    num: int = 8,
    client: httpx.AsyncClient | None = None,
) -> List[Dict[str, Any]]:
    if not SERPER_API_KEY:
        return []

    payload = {"q": query, "num": num}
    headers = {"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}
    try:
        if client is not None:
            resp = await client.post(SERPER_URL, headers=headers, json=payload)
        else:
            async with httpx.AsyncClient(timeout=SERPER_TIMEOUT) as async_client:
                resp = await async_client.post(SERPER_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return []

    return _normalize_results(data)


def search_web(query: str, num: int = 8) -> List[Dict[str, Any]]:
    return run_coro_sync(search_web_async(query, num=num))


def build_guideline_search_queries(context: Dict[str, Any]) -> List[str]:
    return [
        "ADA American Diabetes Association Standards of Care diabetes diet nutrition 2024",
        "ADA diabetes physical activity exercise guidelines",
        "ADA diabetes lifestyle sleep stress smoking cessation guidelines",
        "diabetes medical nutrition therapy carbohydrate guidelines site:diabetesjournals.org OR site:diabetes.org",
    ]


async def fetch_web_results_for_guidelines_async(
    context: Dict[str, Any],
    max_results_per_query: int = 4,
) -> List[Dict[str, Any]]:
    queries = build_guideline_search_queries(context)
    if not queries:
        return []

    async with httpx.AsyncClient(timeout=SERPER_TIMEOUT) as client:
        batches = await asyncio.gather(
            *[
                search_web_async(query, num=max_results_per_query, client=client)
                for query in queries
            ],
            return_exceptions=True,
        )

    seen_links: set[str] = set()
    combined: List[Dict[str, Any]] = []
    for batch in batches:
        if isinstance(batch, Exception):
            continue
        for result in batch:
            link = (result.get("link") or "").strip()
            if not link or link in seen_links:
                continue
            seen_links.add(link)
            combined.append(result)

    trusted_first = [item for item in combined if _is_trusted(item.get("link", ""))]
    others = [item for item in combined if item not in trusted_first]
    return trusted_first + others


def fetch_web_results_for_guidelines(
    context: Dict[str, Any],
    max_results_per_query: int = 4,
) -> List[Dict[str, Any]]:
    return run_coro_sync(
        fetch_web_results_for_guidelines_async(
            context,
            max_results_per_query=max_results_per_query,
        )
    )
