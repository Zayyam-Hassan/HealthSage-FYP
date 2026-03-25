"""
Retrieve medication guidance from the web using Serper. Prefer trusted sources (ADA, NIH, CDC, etc.).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
SERPER_URL = "https://google.serper.dev/search"

TRUSTED_DOMAINS = (
    "diabetesjournals.org",
    "diabetes.org",
    "nih.gov",
    "niddk.nih.gov",
    "cdc.gov",
    "who.int",
    "mayoclinic.org",
    "clevelandclinic.org",
    "uptodate.com",
)


def _search(query: str, num: int = 8) -> List[Dict[str, Any]]:
    """Run one Serper search; return list of {title, link, snippet}."""
    if not SERPER_API_KEY:
        logger.warning("SERPER_API_KEY not set; skipping medication evidence retrieval")
        return []
    payload = {"q": query, "num": num}
    headers = {"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(SERPER_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.exception("Serper request failed: %s", e)
        return []
    organic = data.get("organic") or []
    return [
        {"title": o.get("title", ""), "link": o.get("link", ""), "snippet": o.get("snippet", "")}
        for o in organic
        if o.get("link")
    ]


def _is_trusted(link: str) -> bool:
    link_lower = link.lower()
    return any(d in link_lower for d in TRUSTED_DOMAINS)


def retrieve_medication_guidance(context: Dict[str, Any], top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Use Serper to search trusted sources for diabetes medication guidance.
    Returns normalized list of {title, url, snippet}. Prefers ADA, NIH, CDC, WHO, Mayo, etc.
    """
    queries = [
        "diabetes medication first line treatment site:diabetesjournals.org",
        "ADA diabetes medication therapy recommendations",
        "GLP1 SGLT2 diabetes medication guidelines site:nih.gov",
        "type 2 diabetes treatment algorithm site:mayoclinic.org",
        "ADA Standards of Care diabetes pharmacotherapy site:diabetes.org",
    ]
    seen: set[str] = set()
    combined: List[Dict[str, Any]] = []
    for q in queries:
        results = _search(q, num=6)
        for r in results:
            link = (r.get("link") or "").strip()
            if not link or link in seen:
                continue
            seen.add(link)
            combined.append({
                "title": r.get("title", ""),
                "url": link,
                "snippet": r.get("snippet", ""),
            })
    # Prefer trusted domains at top
    trusted_first = [x for x in combined if _is_trusted(x.get("url", ""))]
    other = [x for x in combined if x not in trusted_first]
    ordered = trusted_first + other
    return ordered[: max(top_k, 10)]


def compress_medical_evidence(results: List[Dict[str, Any]]) -> str:
    """
    Convert retrieved results into a compact block: SOURCE: title / url, then snippet.
    """
    lines: List[str] = []
    for r in results:
        title = (r.get("title") or "").strip()
        url = (r.get("url") or r.get("link") or "").strip()
        snippet = (r.get("snippet") or "").strip()
        source = title or url or "Unknown"
        lines.append(f"SOURCE: {source}")
        if url:
            lines.append(f"URL: {url}")
        lines.append(snippet)
        lines.append("")
    return "\n".join(lines).strip()
