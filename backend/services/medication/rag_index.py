"""
Medication RAG ingestion and persisted local vector index builder.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer

from app.schemas.medication_recommendation import (
    MedicationKnowledgeChunk,
    MedicationChunkMetadata,
    NormalizedDrugEntry,
)

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_PATH = BACKEND_ROOT / "artifacts" / "diabetes_drugs.json"
DEFAULT_INDEX_PATH = BACKEND_ROOT / "artifacts" / "medication_rag_index.joblib"
INDEX_VERSION = 1

SECTION_LABELS = (
    ("overview", "summary"),
    ("warnings", "warnings"),
    ("side_effects", "side_effects"),
    ("before_taking", "before_taking"),
    ("usage", "usage_instructions"),
    ("precautions", "precautions"),
    ("interactions", "interactions"),
)


def _coerce_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (list, tuple, set)):
        return "\n".join(str(v).strip() for v in value if str(v).strip()).strip()
    if isinstance(value, dict):
        parts = []
        for key, item in value.items():
            key_text = str(key).strip()
            item_text = _coerce_text(item)
            if key_text and item_text:
                parts.append(f"{key_text}: {item_text}")
            elif item_text:
                parts.append(item_text)
        return "\n".join(parts).strip()
    return str(value).strip()


def _split_alias_text(text: str) -> List[str]:
    if not text:
        return []
    cleaned = re.sub(r"\band\b", ",", text, flags=re.IGNORECASE)
    return [
        part.strip(" .;:")
        for part in re.split(r"[,/]", cleaned)
        if part and part.strip(" .;:")
    ]


def _dedupe_preserve_order(items: List[str]) -> List[str]:
    seen: set[str] = set()
    ordered: List[str] = []
    for item in items:
        lowered = item.strip().lower()
        if not lowered or lowered in seen:
            continue
        seen.add(lowered)
        ordered.append(item.strip())
    return ordered


def _extract_generic_name(description: str) -> str:
    match = re.search(r"Generic name:\s*([^\[]+)", description or "", flags=re.IGNORECASE)
    if not match:
        return ""
    return match.group(1).strip(" .;:")


def _extract_brand_aliases(description: str) -> List[str]:
    match = re.search(
        r"Other brand names?(?: of [^:]+)? include:\s*([^\.]+)",
        description or "",
        flags=re.IGNORECASE,
    )
    if not match:
        return []
    return _split_alias_text(match.group(1))


def normalize_drug_entry(raw_entry: Dict[str, Any], index: int) -> NormalizedDrugEntry:
    drug_name = _coerce_text(raw_entry.get("name")) or f"drug-{index}"
    other_sections = raw_entry.get("other_sections") or {}
    description = _coerce_text(raw_entry.get("description"))
    what_is_key = next(
        (
            key
            for key in other_sections.keys()
            if isinstance(key, str) and key.strip().lower().startswith("what is ")
        ),
        None,
    )
    overview_parts = [
        description,
        _coerce_text(other_sections.get(what_is_key)) if what_is_key else "",
    ]
    aliases = [drug_name]
    generic_name = _extract_generic_name(description)
    if generic_name:
        aliases.append(generic_name)
    aliases.extend(_extract_brand_aliases(description))
    aliases.extend(_split_alias_text(_coerce_text(other_sections.get("Other brands"))))
    aliases = _dedupe_preserve_order(aliases)

    precautions_parts = [
        _coerce_text(raw_entry.get("avoid")),
        _coerce_text(raw_entry.get("overdose")),
    ]

    rating = raw_entry.get("rating")
    review_count = raw_entry.get("review_count")

    return NormalizedDrugEntry(
        document_id=f"drug-{index:04d}",
        drug_name=drug_name,
        aliases=aliases,
        summary="\n\n".join(part for part in overview_parts if part).strip(),
        warnings=_coerce_text(raw_entry.get("warnings")),
        side_effects=_coerce_text(raw_entry.get("side_effects")),
        before_taking=_coerce_text(raw_entry.get("before_taking")),
        usage_instructions=_coerce_text(raw_entry.get("how_to_use")),
        precautions="\n\n".join(part for part in precautions_parts if part).strip(),
        interactions=_coerce_text(raw_entry.get("interactions")),
        source_url=_coerce_text(raw_entry.get("url")),
        rating=float(rating) if isinstance(rating, (int, float)) else None,
        review_count=int(review_count) if isinstance(review_count, (int, float)) else None,
        raw_source=raw_entry,
    )


def build_semantic_chunks(entry: NormalizedDrugEntry) -> List[MedicationKnowledgeChunk]:
    chunks: List[MedicationKnowledgeChunk] = []
    for section, field_name in SECTION_LABELS:
        content = _coerce_text(getattr(entry, field_name))
        if not content:
            continue
        metadata = MedicationChunkMetadata(
            document_id=entry.document_id,
            chunk_id=f"{entry.document_id}:{section}",
            drug_name=entry.drug_name,
            section=section,
            source_url=entry.source_url,
        )
        chunks.append(MedicationKnowledgeChunk(metadata=metadata, content=content))
    return chunks


def load_medication_knowledge_base(dataset_path: Path | None = None) -> Dict[str, List[Any]]:
    dataset_path = dataset_path or DEFAULT_DATASET_PATH
    if not dataset_path.exists():
        raise FileNotFoundError(f"Medication knowledge base not found: {dataset_path}")

    try:
        raw_data = json.loads(dataset_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed medication knowledge base JSON: {dataset_path}") from exc

    if not isinstance(raw_data, list):
        raise ValueError("Medication knowledge base JSON must be a list of drug entries")
    if not raw_data:
        raise ValueError("Medication knowledge base is empty")

    entries = [
        normalize_drug_entry(raw_entry if isinstance(raw_entry, dict) else {}, index)
        for index, raw_entry in enumerate(raw_data, start=1)
    ]
    chunks: List[MedicationKnowledgeChunk] = []
    for entry in entries:
        chunks.extend(build_semantic_chunks(entry))

    logger.info(
        "medication_knowledge_loaded",
        extra={
            "dataset_path": str(dataset_path),
            "drug_count": len(entries),
            "chunk_count": len(chunks),
        },
    )
    return {"entries": entries, "chunks": chunks}


def build_medication_index(
    dataset_path: Path | None = None,
    index_path: Path | None = None,
) -> Dict[str, Any]:
    dataset_path = dataset_path or DEFAULT_DATASET_PATH
    index_path = index_path or DEFAULT_INDEX_PATH

    loaded = load_medication_knowledge_base(dataset_path)
    entries: List[NormalizedDrugEntry] = loaded["entries"]
    chunks: List[MedicationKnowledgeChunk] = loaded["chunks"]
    if not chunks:
        raise ValueError("Medication knowledge base produced no retrievable chunks")

    texts = [chunk.content for chunk in chunks]
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        sublinear_tf=True,
        strip_accents="unicode",
    )
    matrix = vectorizer.fit_transform(texts)

    index_payload: Dict[str, Any] = {
        "version": INDEX_VERSION,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "dataset_path": str(dataset_path),
        "dataset_mtime_ns": dataset_path.stat().st_mtime_ns,
        "entries": [entry.model_dump() for entry in entries],
        "chunks": [chunk.model_dump() for chunk in chunks],
        "vectorizer": vectorizer,
        "matrix": matrix,
    }

    index_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(index_payload, index_path)
    logger.info(
        "medication_index_built",
        extra={
            "index_path": str(index_path),
            "drug_count": len(entries),
            "chunk_count": len(chunks),
        },
    )
    return index_payload


def load_built_index(index_path: Path | None = None) -> Dict[str, Any]:
    index_path = index_path or DEFAULT_INDEX_PATH
    if not index_path.exists():
        raise FileNotFoundError(f"Medication index not found: {index_path}")
    try:
        payload = joblib.load(index_path)
    except Exception as exc:
        raise ValueError(f"Failed to load medication index: {index_path}") from exc
    if not isinstance(payload, dict) or "vectorizer" not in payload or "matrix" not in payload:
        raise ValueError("Medication index payload is invalid")
    return payload
