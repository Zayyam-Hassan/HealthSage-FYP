from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.medication_routes import rag_router, router


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.include_router(rag_router)
    return TestClient(app)


def _recommendation_result(patient_id: str):
    return {
        "recommended_medications": [],
        "clinical_reasoning": "ok",
        "warnings": [],
        "confidence_score": 0.8,
        "agent_trace": [],
        "patient_id": patient_id,
    }


def _rag_result():
    return [
        {
            "drug_name": "Metformin",
            "section": "summary",
            "content": "Useful for T2D",
            "source_url": "",
            "source_title": "doc",
            "source_type": "local_drug_rag",
            "source": "local",
            "relevance": "high",
            "score": 0.9,
            "document_id": "d1",
            "chunk_id": "c1",
        }
    ]


def test_medication_recommendation_success(monkeypatch):
    monkeypatch.setattr(
        "api.medication_routes.generate_patient_medication_recommendation",
        lambda **kwargs: _recommendation_result(kwargs["patient_id"]),
    )
    client = build_client()
    resp = client.post("/recommendations/medication/p1")
    assert resp.status_code == 200
    assert resp.json()["patient_id"] == "p1"


def test_medication_recommendation_value_error_422(monkeypatch):
    monkeypatch.setattr(
        "api.medication_routes.generate_patient_medication_recommendation",
        lambda **kwargs: (_ for _ in ()).throw(ValueError("bad input")),
    )
    client = build_client()
    resp = client.post("/recommendations/medication/p1")
    assert resp.status_code == 422


def test_medication_recommendation_file_not_found_503(monkeypatch):
    monkeypatch.setattr(
        "api.medication_routes.generate_patient_medication_recommendation",
        lambda **kwargs: (_ for _ in ()).throw(FileNotFoundError("missing index")),
    )
    client = build_client()
    resp = client.post("/recommendations/medication/p1")
    assert resp.status_code == 503


def test_medication_recommendation_generic_error_500(monkeypatch):
    monkeypatch.setattr(
        "api.medication_routes.generate_patient_medication_recommendation",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("oops")),
    )
    client = build_client()
    resp = client.post("/recommendations/medication/p1")
    assert resp.status_code == 500


def test_medication_rag_search_success(monkeypatch):
    monkeypatch.setattr("api.medication_routes.search_medication_knowledge", lambda **kwargs: _rag_result())
    monkeypatch.setattr("api.medication_routes.retrieve_guideline_evidence", lambda **kwargs: _rag_result())
    monkeypatch.setattr("api.medication_routes.build_guideline_query", lambda patient_context, base_query: base_query)
    monkeypatch.setattr("api.medication_routes.summarize_guideline_influence", lambda results: ["influenced"])

    client = build_client()
    resp = client.post("/medication-rag/search", json={"query": "metformin", "top_k": 1})
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 1


def test_medication_rag_search_value_error_422(monkeypatch):
    monkeypatch.setattr(
        "api.medication_routes.search_medication_knowledge",
        lambda **kwargs: (_ for _ in ()).throw(ValueError("bad query")),
    )
    client = build_client()
    resp = client.post("/medication-rag/search", json={"query": "metformin", "top_k": 1})
    assert resp.status_code == 422
