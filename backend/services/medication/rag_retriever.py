"""
Medication RAG retrieval and grounding helpers.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.schemas.medication_recommendation import (
    GroundedMedicationRecommendationResponse,
    GroundedRecommendationEvidenceBlock,
    MedicationKnowledgeChunk,
    MedicationRagFilters,
    MedicationRagSearchResult,
    SupportingMedicationEvidence,
)

from .rag_index import (
    DEFAULT_DATASET_PATH,
    DEFAULT_INDEX_PATH,
    build_medication_index,
    load_built_index,
)

logger = logging.getLogger(__name__)

_INDEX_CACHE: Optional[Dict[str, Any]] = None


def _normalize_name(value: str) -> str:
    return (value or "").strip().lower()


def _split_excerpt(text: str, limit: int = 2) -> List[str]:
    if not text:
        return []
    normalized = text.replace("\r", "\n")
    parts = [part.strip(" -\n\t") for part in normalized.split("\n\n") if part.strip()]
    if not parts:
        parts = [part.strip(" -\n\t") for part in normalized.splitlines() if part.strip()]
    return parts[:limit]


def _trim_content(text: str, limit: int = 650) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def merge_medication_evidence_results(
    local_results: List[MedicationRagSearchResult],
    online_results: List[MedicationRagSearchResult],
    limit: int = 12,
) -> List[MedicationRagSearchResult]:
    combined = sorted(
        [*local_results, *online_results],
        key=lambda item: float(item.score),
        reverse=True,
    )
    deduped: List[MedicationRagSearchResult] = []
    seen: set[tuple[str, str, str]] = set()
    for item in combined:
        key = (
            item.source_type.strip().lower(),
            (item.source_url or "").strip().lower(),
            (item.guideline_id or item.document_id or "").strip().lower(),
            item.section.strip().lower(),
            item.drug_name.strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
        if len(deduped) >= limit:
            break
    return deduped


def _expand_query(query: str) -> str:
    original = (query or "").strip()
    if not original:
        return ""
    normalized = original.lower()
    expansions: List[str] = []
    synonym_map = {
        "rapid acting": "fast acting mealtime insulin",
        "before meals": "before meal mealtime",
        "after meals": "after eating mealtime",
        "long acting": "basal once daily insulin",
        "glp-1": "glp1 agonist incretin",
        "glp1": "glp-1 agonist incretin",
        "sglt2": "sglt-2 inhibitor renal glucose",
        "sglt-2": "sglt2 inhibitor renal glucose",
    }
    for needle, replacement in synonym_map.items():
        if needle in normalized:
            expansions.append(replacement)
    return " ".join([original] + expansions).strip()


def _adjust_score(
    raw_score: float,
    chunk: MedicationKnowledgeChunk,
    query: str,
) -> float:
    score = raw_score
    lowered_query = (query or "").lower()
    lowered_content = chunk.content.lower()
    section = chunk.metadata.section.lower()

    timing_query = any(term in lowered_query for term in ("rapid acting", "fast acting", "before meals", "before meal", "mealtime"))
    safety_query = any(term in lowered_query for term in ("warning", "warnings", "interaction", "interactions", "contraindication", "avoid"))

    if timing_query:
        if any(term in lowered_content for term in ("fast-acting", "rapid-acting", "mealtime", "before a meal", "before meal", "just after you eat", "after eating")):
            score += 0.05
        if section in {"overview", "usage", "warnings"}:
            score += 0.03
        if section in {"before_taking", "interactions"}:
            score -= 0.05
        if section == "before_taking" and any(term in lowered_content for term in ("you also use", "do not use", "should not use")):
            score -= 0.06

    if not safety_query and section in {"interactions"}:
        score -= 0.01

    return score


def _dataset_is_stale(index_payload: Dict[str, Any], dataset_path: Path) -> bool:
    try:
        current_mtime = dataset_path.stat().st_mtime_ns
    except FileNotFoundError:
        return True
    return int(index_payload.get("dataset_mtime_ns") or 0) != current_mtime


def ensure_medication_index(force_rebuild: bool = False) -> Dict[str, Any]:
    global _INDEX_CACHE
    dataset_path = DEFAULT_DATASET_PATH
    index_path = DEFAULT_INDEX_PATH

    if not force_rebuild and _INDEX_CACHE is not None and not _dataset_is_stale(_INDEX_CACHE, dataset_path):
        return _INDEX_CACHE

    if force_rebuild:
        _INDEX_CACHE = build_medication_index(dataset_path=dataset_path, index_path=index_path)
        return _INDEX_CACHE

    try:
        payload = load_built_index(index_path=index_path)
        if _dataset_is_stale(payload, dataset_path):
            logger.info(
                "medication_index_stale_rebuilding",
                extra={"index_path": str(index_path), "dataset_path": str(dataset_path)},
            )
            payload = build_medication_index(dataset_path=dataset_path, index_path=index_path)
    except (FileNotFoundError, ValueError):
        payload = build_medication_index(dataset_path=dataset_path, index_path=index_path)

    _INDEX_CACHE = payload
    return payload


def _get_chunks(index_payload: Dict[str, Any]) -> List[MedicationKnowledgeChunk]:
    return [
        chunk if isinstance(chunk, MedicationKnowledgeChunk) else MedicationKnowledgeChunk(**chunk)
        for chunk in (index_payload.get("chunks") or [])
    ]


def _get_alias_map(index_payload: Dict[str, Any]) -> Dict[str, set[str]]:
    alias_map: Dict[str, set[str]] = {}
    for entry in index_payload.get("entries") or []:
        if not isinstance(entry, dict):
            continue
        drug_name = _normalize_name(str(entry.get("drug_name", "")))
        if not drug_name:
            continue
        alias_map.setdefault(drug_name, set()).add(drug_name)
        for alias in entry.get("aliases") or []:
            alias_text = _normalize_name(str(alias))
            if alias_text:
                alias_map[drug_name].add(alias_text)
    return alias_map


def build_medication_retrieval_query(
    context: Dict[str, Any],
    clinical_output: Any | None = None,
) -> str:
    terms: List[str] = ["diabetes medication recommendation"]
    for key in ("diabetes_type", "renal_status"):
        value = context.get(key)
        if value not in (None, "", []):
            terms.append(f"{key.replace('_', ' ')} {value}")
    for key in ("HbA1c", "BMI", "fasting_glucose", "risk_score"):
        value = context.get(key)
        if value is not None:
            terms.append(f"{key} {value}")

    conditions = context.get("conditions") or []
    current_medications = context.get("current_medications") or []
    allergies = context.get("allergies") or []
    if conditions:
        terms.append("conditions " + " ".join(str(item) for item in conditions[:6]))
    if current_medications:
        terms.append("current medications " + " ".join(str(item) for item in current_medications[:6]))
    if allergies:
        terms.append("allergies " + " ".join(str(item) for item in allergies[:4]))

    if clinical_output is not None:
        clinical_summary = getattr(clinical_output, "clinical_summary", "")
        treatment_goals = getattr(clinical_output, "treatment_goals", []) or []
        risk_factors = getattr(clinical_output, "key_risk_factors", []) or []
        contraindications = getattr(clinical_output, "contraindication_signals", []) or []
        for value in (clinical_summary, " ".join(treatment_goals), " ".join(risk_factors), " ".join(contraindications)):
            if value:
                terms.append(str(value))

    return " ".join(term for term in terms if term).strip()


def search_medication_knowledge(
    query: str,
    top_k: int = 5,
    filters: MedicationRagFilters | Dict[str, Any] | None = None,
) -> List[MedicationRagSearchResult]:
    if not (query or "").strip():
        raise ValueError("Medication retrieval query is required")

    index_payload = ensure_medication_index()
    chunks = _get_chunks(index_payload)
    alias_map = _get_alias_map(index_payload)
    filter_model = (
        filters
        if isinstance(filters, MedicationRagFilters)
        else MedicationRagFilters(**(filters or {}))
    )

    expanded_query = _expand_query(query)
    query_vector = index_payload["vectorizer"].transform([expanded_query])
    raw_scores = cosine_similarity(query_vector, index_payload["matrix"]).ravel()
    scores = np.array(
        [
            _adjust_score(float(raw_scores[idx]), chunks[idx], expanded_query)
            for idx in range(len(chunks))
        ]
    )

    requested_name = _normalize_name(filter_model.drug_name or "")
    requested_section = _normalize_name(filter_model.section or "")
    ranked_indexes = np.argsort(scores)[::-1]

    results: List[MedicationRagSearchResult] = []
    for idx in ranked_indexes:
        chunk = chunks[int(idx)]
        score = float(scores[idx])
        if score <= 0:
            continue
        drug_name = _normalize_name(chunk.metadata.drug_name)
        if requested_name:
            aliases = alias_map.get(drug_name) or {drug_name}
            if requested_name not in aliases and requested_name != drug_name:
                continue
        if requested_section and _normalize_name(chunk.metadata.section) != requested_section:
            continue
        results.append(
            MedicationRagSearchResult(
                drug_name=chunk.metadata.drug_name,
                section=chunk.metadata.section,
                content=_trim_content(chunk.content),
                source_url=chunk.metadata.source_url,
                source_title=chunk.metadata.drug_name,
                source_type="local_drug_rag",
                source=chunk.metadata.source_url or "Local diabetes drug knowledge base",
                relevance=f"drug section {chunk.metadata.section}",
                score=round(score, 4),
                document_id=chunk.metadata.document_id,
                chunk_id=chunk.metadata.chunk_id,
            )
        )
        if len(results) >= top_k:
            break

    logger.info(
        "medication_retrieval_completed",
        extra={
            "query": query[:200],
            "expanded_query": expanded_query[:200],
            "top_k": top_k,
            "result_count": len(results),
            "filter_drug_name": filter_model.drug_name,
            "filter_section": filter_model.section,
        },
    )
    return results


def build_medication_evidence_block(results: List[MedicationRagSearchResult]) -> str:
    if not results:
        return "No medication evidence was retrieved from the local drug knowledge base, guideline RAG, or online Serper sources."

    lines: List[str] = []
    for result in results:
        source_title = (result.source_title or "").strip()
        lines.extend(
            [
                f"DRUG: {result.drug_name}",
                f"SECTION: {result.section}",
                f"SOURCE_TYPE: {result.source_type}",
                f"SOURCE_TITLE: {source_title or result.drug_name}",
                f"SOURCE: {result.source or result.source_url or source_title or result.drug_name}",
                f"RELEVANCE: {result.relevance}",
                f"SOURCE_URL: {result.source_url}",
                f"SCORE: {result.score}",
                f"CONTENT: {result.content}",
                "",
            ]
        )
    return "\n".join(lines).strip()


def ground_medication_recommendations(
    patient_context: Dict[str, Any],
    recommendation_request: Dict[str, Any] | str | None,
    retrieved_medication_evidence: List[MedicationRagSearchResult],
    existing_api_result: Dict[str, Any] | None = None,
) -> GroundedMedicationRecommendationResponse:
    existing_api_result = existing_api_result or {}
    recommended = existing_api_result.get("recommended_medications") or []
    if not recommended:
        return GroundedMedicationRecommendationResponse(
            recommendations=[],
            general_warnings=[],
            evidence_strength="weak",
            notes="No medication recommendations were produced by the existing agent flow.",
        )

    evidence_by_drug: Dict[str, List[MedicationRagSearchResult]] = {}
    guideline_hits = [item for item in retrieved_medication_evidence if item.source_type == "guideline"]
    for item in retrieved_medication_evidence:
        if item.source_type == "guideline":
            continue
        evidence_by_drug.setdefault(_normalize_name(item.drug_name), []).append(item)

    grounded_items: List[GroundedRecommendationEvidenceBlock] = []
    general_warnings: List[str] = []
    unmatched: List[str] = []

    for item in recommended:
        if isinstance(item, dict):
            medication_name = str(item.get("name") or item.get("drug_name") or "").strip()
            why_it_matches = str(item.get("reason") or "").strip()
        else:
            medication_name = str(item).strip()
            why_it_matches = ""

        if not medication_name:
            continue

        hits = evidence_by_drug.get(_normalize_name(medication_name), [])
        if not hits:
            hits = search_medication_knowledge(
                query=medication_name,
                top_k=3,
                filters=MedicationRagFilters(drug_name=medication_name),
            )

        if not hits:
            unmatched.append(medication_name)

        drug_evidence = [
            SupportingMedicationEvidence(
                drug_name=hit.drug_name,
                section=hit.section,
                content=hit.content,
                source_url=hit.source_url,
                source_title=hit.source_title,
                source_type=hit.source_type,
                source=hit.source,
                relevance=hit.relevance,
                guideline_id=hit.guideline_id,
                condition_type=hit.condition_type,
                recommendation_type=hit.recommendation_type,
            )
            for hit in hits[:3]
        ]
        guideline_support = [
            SupportingMedicationEvidence(
                drug_name=medication_name,
                section=hit.section,
                content=hit.content,
                source_url=hit.source_url,
                source_title=hit.source_title,
                source_type=hit.source_type,
                source=hit.source,
                relevance=hit.relevance,
                guideline_id=hit.guideline_id,
                condition_type=hit.condition_type,
                recommendation_type=hit.recommendation_type,
            )
            for hit in guideline_hits[:2]
        ]
        supporting_evidence = [*guideline_support, *drug_evidence][:4]

        key_warnings = []
        key_interactions = []
        for hit in hits:
            if hit.section in {"warnings", "before_taking", "precautions"}:
                key_warnings.extend(_split_excerpt(hit.content, limit=1))
            if hit.section == "interactions":
                key_interactions.extend(_split_excerpt(hit.content, limit=1))

        key_warnings = list(dict.fromkeys(key_warnings))[:3]
        key_interactions = list(dict.fromkeys(key_interactions))[:3]
        general_warnings.extend(key_warnings)

        guideline_reason = ""
        if guideline_support:
            top_guideline = guideline_support[0]
            rec_type = (top_guideline.recommendation_type or "").replace("_", " ")
            if rec_type:
                guideline_reason = f"Retrieved guideline evidence supports {rec_type} in this patient context."
            else:
                guideline_reason = "Retrieved guideline evidence supports this treatment direction for the patient context."

        if not why_it_matches:
            if drug_evidence and guideline_support:
                why_it_matches = "This option is included because both medication evidence and patient-matched guideline evidence were retrieved."
            elif drug_evidence:
                why_it_matches = "This option is included because matching drug evidence was retrieved for this medication."
            elif guideline_support:
                why_it_matches = "This option is included because retrieved guideline evidence supports this treatment direction for the patient context."
            else:
                why_it_matches = "This option was generated by the existing agent flow, but supporting knowledge-base evidence was weak."
        why_it_matches_patient = why_it_matches
        if guideline_reason and guideline_reason not in why_it_matches_patient:
            why_it_matches_patient = f"{why_it_matches_patient} {guideline_reason}".strip()

        if drug_evidence and guideline_support:
            confidence = "high"
        elif drug_evidence or guideline_support:
            confidence = "medium"
        else:
            confidence = "low"

        grounded_items.append(
            GroundedRecommendationEvidenceBlock(
                medication_name=medication_name,
                why_it_matches=why_it_matches,
                why_it_matches_patient=why_it_matches_patient,
                key_warnings=key_warnings,
                key_interactions=key_interactions,
                supporting_evidence=supporting_evidence,
                guideline_support=guideline_support,
                drug_evidence=drug_evidence,
                confidence=confidence,
            )
        )

    high_confidence = sum(1 for item in grounded_items if item.confidence == "high")
    supported_count = sum(1 for item in grounded_items if item.supporting_evidence)
    if grounded_items and high_confidence == len(grounded_items):
        evidence_strength = "strong"
    elif supported_count > 0:
        evidence_strength = "moderate"
    else:
        evidence_strength = "weak"

    notes_parts = []
    if recommendation_request:
        notes_parts.append("Grounding applied to the current medication recommendation request.")
    if unmatched:
        notes_parts.append(
            "Evidence was weak or missing for: " + ", ".join(unmatched) + "."
        )
    if not retrieved_medication_evidence:
        notes_parts.append("No medication evidence was retrieved from the local index.")
    if not guideline_hits:
        notes_parts.append("Guideline evidence was weak or missing for this patient context.")
    if any(item.source_type == "online_research" for item in retrieved_medication_evidence):
        notes_parts.append("Online medication evidence from Serper-backed sources was also used.")
    if guideline_hits:
        notes_parts.append("Patient-aware guideline evidence was used alongside drug evidence.")

    return GroundedMedicationRecommendationResponse(
        recommendations=grounded_items,
        general_warnings=list(dict.fromkeys(general_warnings))[:6],
        evidence_strength=evidence_strength,
        notes=" ".join(notes_parts).strip() or "Grounded using the local diabetes medication knowledge base.",
    )
