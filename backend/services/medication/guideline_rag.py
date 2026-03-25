"""
Lightweight guideline retrieval for diabetes medication recommendations.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.schemas.medication_recommendation import GuidelineEntry, MedicationRagSearchResult

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GUIDELINE_DATASET_PATH = BACKEND_ROOT / "artifacts" / "diabetes_guidelines.json"
DEFAULT_GUIDELINE_INDEX_PATH = BACKEND_ROOT / "artifacts" / "guideline_rag_index.joblib"
GUIDELINE_INDEX_VERSION = 1

_GUIDELINE_CACHE: Optional[Dict[str, Any]] = None


def _normalize(value: Any) -> str:
    return str(value or "").strip()


def load_guideline_entries(dataset_path: Path | None = None) -> List[GuidelineEntry]:
    dataset_path = dataset_path or DEFAULT_GUIDELINE_DATASET_PATH
    if not dataset_path.exists():
        raise FileNotFoundError(f"Guideline dataset not found: {dataset_path}")
    try:
        raw = json.loads(dataset_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed guideline dataset JSON: {dataset_path}") from exc
    if not isinstance(raw, list) or not raw:
        raise ValueError("Guideline dataset must be a non-empty list")
    entries = [GuidelineEntry(**item) for item in raw]
    logger.info(
        "guideline_dataset_loaded",
        extra={"dataset_path": str(dataset_path), "entry_count": len(entries)},
    )
    return entries


def _entry_text(entry: GuidelineEntry) -> str:
    parts = [
        entry.title,
        f"Condition: {entry.condition}",
        f"Recommendation: {entry.recommendation}",
        f"Notes: {entry.notes}",
        f"Condition type: {entry.condition_type}",
        f"Recommendation type: {entry.recommendation_type}",
        f"Source: {entry.source}",
    ]
    return "\n".join(part for part in parts if part.strip())


def build_guideline_index(
    dataset_path: Path | None = None,
    index_path: Path | None = None,
) -> Dict[str, Any]:
    dataset_path = dataset_path or DEFAULT_GUIDELINE_DATASET_PATH
    index_path = index_path or DEFAULT_GUIDELINE_INDEX_PATH
    entries = load_guideline_entries(dataset_path)
    texts = [_entry_text(entry) for entry in entries]
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        sublinear_tf=True,
        strip_accents="unicode",
    )
    matrix = vectorizer.fit_transform(texts)
    payload = {
        "version": GUIDELINE_INDEX_VERSION,
        "dataset_path": str(dataset_path),
        "dataset_mtime_ns": dataset_path.stat().st_mtime_ns,
        "entries": [entry.model_dump() for entry in entries],
        "texts": texts,
        "vectorizer": vectorizer,
        "matrix": matrix,
    }
    index_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, index_path)
    logger.info(
        "guideline_index_built",
        extra={"index_path": str(index_path), "entry_count": len(entries)},
    )
    return payload


def _load_guideline_index(index_path: Path | None = None) -> Dict[str, Any]:
    index_path = index_path or DEFAULT_GUIDELINE_INDEX_PATH
    if not index_path.exists():
        raise FileNotFoundError(f"Guideline index not found: {index_path}")
    payload = joblib.load(index_path)
    if not isinstance(payload, dict) or "vectorizer" not in payload or "matrix" not in payload:
        raise ValueError("Guideline index payload is invalid")
    return payload


def _dataset_is_stale(payload: Dict[str, Any], dataset_path: Path) -> bool:
    try:
        return int(payload.get("dataset_mtime_ns") or 0) != dataset_path.stat().st_mtime_ns
    except FileNotFoundError:
        return True


def ensure_guideline_index(force_rebuild: bool = False) -> Dict[str, Any]:
    global _GUIDELINE_CACHE
    dataset_path = DEFAULT_GUIDELINE_DATASET_PATH
    index_path = DEFAULT_GUIDELINE_INDEX_PATH

    if not force_rebuild and _GUIDELINE_CACHE is not None and not _dataset_is_stale(_GUIDELINE_CACHE, dataset_path):
        return _GUIDELINE_CACHE

    if force_rebuild:
        _GUIDELINE_CACHE = build_guideline_index(dataset_path=dataset_path, index_path=index_path)
        return _GUIDELINE_CACHE

    try:
        payload = _load_guideline_index(index_path=index_path)
        if _dataset_is_stale(payload, dataset_path):
            payload = build_guideline_index(dataset_path=dataset_path, index_path=index_path)
    except (FileNotFoundError, ValueError):
        payload = build_guideline_index(dataset_path=dataset_path, index_path=index_path)

    _GUIDELINE_CACHE = payload
    return payload


def build_guideline_query(
    patient_context: Dict[str, Any],
    clinical_output: Any | None = None,
    base_query: str | None = None,
) -> str:
    diabetes_type = _normalize(patient_context.get("diabetes_type") or "type 2 diabetes")
    terms: List[str] = [base_query.strip()] if base_query and base_query.strip() else []
    terms.append(diabetes_type)

    hba1c = patient_context.get("HbA1c")
    fasting_glucose = patient_context.get("fasting_glucose")
    current_medications = patient_context.get("current_medications") or []
    conditions = [str(item) for item in (patient_context.get("conditions") or [])]
    renal_status = _normalize(patient_context.get("renal_status"))

    if hba1c is not None:
        terms.append(f"HbA1c {hba1c}")
    if fasting_glucose is not None:
        terms.append(f"fasting glucose {fasting_glucose}")
    if current_medications:
        terms.append("already on " + ", ".join(str(item) for item in current_medications[:4]))
    if conditions:
        terms.append("conditions " + ", ".join(conditions[:5]))
    if renal_status:
        terms.append(f"renal status {renal_status}")

    if clinical_output is not None:
        goals = getattr(clinical_output, "treatment_goals", []) or []
        contraindications = getattr(clinical_output, "contraindication_signals", []) or []
        if goals:
            terms.append("treatment goals " + ", ".join(str(item) for item in goals[:4]))
        if contraindications:
            terms.append("contraindications " + ", ".join(str(item) for item in contraindications[:4]))

    # Lightweight patient-aware intent enrichment for retrieval.
    if "type 1" in diabetes_type.lower():
        terms.append("insulin required")
    if hba1c is not None:
        try:
            hba1c_value = float(hba1c)
            if hba1c_value >= 10:
                terms.extend(["insulin initiation", "severe hyperglycemia"])
            elif hba1c_value >= 9:
                terms.extend(["therapy escalation", "add-on therapy"])
            elif not current_medications:
                terms.extend(["first line therapy", "metformin"])
        except (TypeError, ValueError):
            pass
    if current_medications:
        terms.extend(["add-on therapy", "continue metformin"])
    if any(keyword in " ".join(conditions).lower() for keyword in ("kidney", "ckd", "heart failure", "ascvd", "cardiovascular")):
        terms.extend(["cardiorenal benefit", "SGLT2 inhibitor", "GLP-1 receptor agonist"])
    if any(keyword in " ".join(conditions).lower() for keyword in ("obesity", "overweight")) or (patient_context.get("BMI") or 0) >= 30:
        terms.extend(["weight benefit", "low hypoglycemia risk"])

    return ", ".join(dict.fromkeys(term for term in terms if term))


def _relevance_text(entry: GuidelineEntry) -> str:
    details = [entry.recommendation_type, entry.condition_type]
    return ", ".join(part.replace("_", " ") for part in details if part)


def retrieve_guideline_evidence(
    query: str,
    patient_context: Dict[str, Any] | None = None,
    top_k: int = 4,
) -> List[MedicationRagSearchResult]:
    if not _normalize(query):
        raise ValueError("Guideline retrieval query is required")
    payload = ensure_guideline_index()
    entries = [GuidelineEntry(**item) for item in (payload.get("entries") or [])]
    query_vector = payload["vectorizer"].transform([query])
    scores = cosine_similarity(query_vector, payload["matrix"]).ravel()
    ranked_indexes = np.argsort(scores)[::-1]
    results: List[MedicationRagSearchResult] = []
    for idx in ranked_indexes:
        score = float(scores[idx])
        if score <= 0:
            continue
        entry = entries[int(idx)]
        results.append(
            MedicationRagSearchResult(
                drug_name="Guideline evidence",
                section="guideline",
                content=f"{entry.title}: {entry.recommendation} {entry.notes}".strip(),
                source_url=entry.source_url,
                source_title=entry.title,
                source_type="guideline",
                source=entry.source,
                relevance=_relevance_text(entry),
                score=round(min(score + 0.05, 0.99), 4),
                document_id=entry.id,
                chunk_id=f"{entry.id}:guideline",
                guideline_id=entry.id,
                condition_type=entry.condition_type,
                recommendation_type=entry.recommendation_type,
            )
        )
        if len(results) >= top_k:
            break

    logger.info(
        "guideline_retrieval_completed",
        extra={
            "query": query[:200],
            "result_count": len(results),
            "patient_id": (patient_context or {}).get("patient_id"),
        },
    )
    return results


def summarize_guideline_influence(results: List[MedicationRagSearchResult]) -> List[str]:
    notes: List[str] = []
    for result in results[:3]:
        recommendation_type = _normalize(result.recommendation_type).replace("_", " ")
        prefix = f"{recommendation_type.title()}: " if recommendation_type else ""
        notes.append(f"{prefix}{result.content[:180]}{'...' if len(result.content) > 180 else ''}")
    return notes
