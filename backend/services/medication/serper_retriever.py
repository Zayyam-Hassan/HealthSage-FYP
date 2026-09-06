"""
Retrieve medication guidance from the web using Serper. Prefer trusted sources (ADA, NIH, CDC, etc.).
"""
from __future__ import annotations

import concurrent.futures
import logging
import os
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

from app.schemas.medication_recommendation import MedicationRagSearchResult

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
SERPER_URL = "https://google.serper.dev/search"
SERPER_TIMEOUT = float(os.getenv("SERPER_TIMEOUT", "15"))
SERPER_MAX_WORKERS = max(1, int(os.getenv("SERPER_MAX_WORKERS", "4")))
SERPER_MAX_BASE_QUERIES = max(1, int(os.getenv("SERPER_MAX_BASE_QUERIES", "5")))
SERPER_MAX_TARGETED_DRUGS = max(1, int(os.getenv("SERPER_MAX_TARGETED_DRUGS", "2")))

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
    "drugbank.com",
    "drugs.com",
    "medlineplus.gov",
    "rxlist.com",
    "accessdata.fda.gov",
    "dailymed.nlm.nih.gov",
    "webmd.com",
)


def _search(query: str, num: int = 8) -> List[Dict[str, Any]]:
    """Run one Serper search; return list of {title, link, snippet}."""
    if not SERPER_API_KEY:
        logger.warning("SERPER_API_KEY not set; skipping medication evidence retrieval")
        return []
    payload = {"q": query, "num": num}
    headers = {"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=SERPER_TIMEOUT) as client:
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


def _search_many(queries: List[str], num: int = 5) -> List[Dict[str, Any]]:
    """Run multiple Serper searches concurrently to avoid additive per-query latency."""
    if not queries:
        return []

    results: List[Dict[str, Any]] = []
    started_at = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(queries), SERPER_MAX_WORKERS)) as executor:
        futures = {executor.submit(_search, query, num): query for query in queries}
        for future in concurrent.futures.as_completed(futures):
            query = futures[future]
            try:
                hits = future.result()
            except Exception as exc:
                logger.warning("Serper sub-search failed for '%s': %s", query, exc)
                continue
            results.extend(hits)

    logger.info(
        "medication_serper_batch_completed",
        extra={
            "query_count": len(queries),
            "timeout_seconds": SERPER_TIMEOUT,
            "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
            "result_count": len(results),
        },
    )
    return results


def _is_trusted(link: str) -> bool:
    link_lower = link.lower()
    return any(d in link_lower for d in TRUSTED_DOMAINS)


def _normalize_drug_name(name: str) -> str:
    return (name or "").strip().lower()


def _dedupe_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    deduped: List[Dict[str, Any]] = []
    for result in results:
        url = (result.get("url") or result.get("link") or "").strip()
        title = (result.get("title") or "").strip().lower()
        key = (url, title)
        if not url or key in seen:
            continue
        seen.add(key)
        deduped.append(result)
    return deduped


def _guess_drug_name(query: str, title: str, snippet: str, drug_names: Optional[List[str]] = None) -> str:
    haystack = f"{title} {snippet}".lower()
    for candidate in drug_names or []:
        normalized = _normalize_drug_name(candidate)
        if normalized and normalized in haystack:
            return candidate
    if drug_names:
        return drug_names[0]
    query_tokens = [token for token in query.split() if len(token) > 2]
    if query_tokens:
        return query_tokens[0].strip().title()
    return "Online medication evidence"


def _score_result(rank: int, url: str) -> float:
    score = max(0.2, 0.95 - (rank * 0.07))
    if _is_trusted(url):
        score += 0.03
    return round(min(score, 0.99), 4)


def _section_from_url(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "drugbank.com" in host:
        return "drugbank_summary"
    if "drugs.com" in host:
        return "drug_reference"
    if "accessdata.fda.gov" in host or "dailymed.nlm.nih.gov" in host:
        return "label_information"
    return "web_result"


def build_medication_web_queries(query: str, drug_names: Optional[List[str]] = None) -> List[str]:
    terms: List[str] = []
    normalized_names = []
    for name in drug_names or []:
        cleaned = name.strip()
        if cleaned and cleaned.lower() not in {item.lower() for item in normalized_names}:
            normalized_names.append(cleaned)

    if normalized_names:
        for name in normalized_names[:SERPER_MAX_TARGETED_DRUGS]:
            terms.extend([
                f"{name} diabetes medication site:drugbank.com",
                f"{name} diabetes medication site:drugs.com",
                f"{name} prescribing information site:accessdata.fda.gov",
            ])
    else:
        terms.extend([
            f"{query} diabetes medication site:drugbank.com",
            f"{query} diabetes medication site:drugs.com",
            f"{query} diabetes medication site:medlineplus.gov",
        ])

    # Keep one general guidance pass for broader context.
    terms.extend([
        f"{query} diabetes medication treatment site:diabetes.org",
        f"{query} diabetes pharmacotherapy site:nih.gov",
    ])
    return terms[:SERPER_MAX_BASE_QUERIES] if not normalized_names else terms


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


def retrieve_online_medication_evidence(
    query: str,
    drug_names: Optional[List[str]] = None,
    top_k: int = 8,
) -> List[MedicationRagSearchResult]:
    """
    Retrieve medication evidence from online sources like DrugBank, Drugs.com,
    FDA labeling pages, and diabetes guidance sites via Serper.
    """
    queries = build_medication_web_queries(query, drug_names=drug_names)
    aggregated: List[Dict[str, Any]] = []
    for result in _search_many(queries, num=5):
        link = (result.get("link") or "").strip()
        if not link:
            continue
        aggregated.append({
            "title": result.get("title", ""),
            "url": link,
            "snippet": result.get("snippet", ""),
        })

    deduped = _dedupe_results(aggregated)
    trusted_first = [item for item in deduped if _is_trusted(item.get("url", ""))]
    ordered = trusted_first + [item for item in deduped if item not in trusted_first]

    search_results: List[MedicationRagSearchResult] = []
    for index, item in enumerate(ordered[:top_k]):
        title = (item.get("title") or "").strip()
        url = (item.get("url") or "").strip()
        snippet = (item.get("snippet") or "").strip()
        drug_name = _guess_drug_name(query, title, snippet, drug_names=drug_names)
        section = _section_from_url(url)
        search_results.append(
            MedicationRagSearchResult(
                drug_name=drug_name,
                section=section,
                content=snippet or title or url,
                source_url=url,
                source_title=title or None,
                source_type="online_research",
                source=title or url,
                relevance=_section_from_url(url).replace("_", " "),
                score=_score_result(index, url),
                document_id=f"serper:{index + 1}",
                chunk_id=f"serper:{index + 1}:{section}",
            )
        )

    logger.info(
        "online_medication_evidence_retrieved",
        extra={
            "query": query[:200],
            "top_k": top_k,
            "drug_names": drug_names or [],
            "result_count": len(search_results),
        },
    )
    return search_results


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
