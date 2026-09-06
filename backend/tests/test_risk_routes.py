from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.risk_routes import router


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_get_risk_success(monkeypatch):
    monkeypatch.setattr(
        "api.risk_routes.predict_patient_risk",
        lambda patient_id: {"patient_id": patient_id, "risk_score": 0.2, "risk_label": "low"},
    )
    client = build_client()
    resp = client.get("/risk/p1")
    assert resp.status_code == 200
    assert resp.json()["risk_label"] == "low"


def test_get_risk_success_when_audit_log_fails(monkeypatch):
    monkeypatch.setattr(
        "api.risk_routes.predict_patient_risk",
        lambda patient_id: {"patient_id": patient_id, "risk_score": 0.2, "risk_label": "low"},
    )
    monkeypatch.setattr("api.risk_routes.get_db", lambda: (_ for _ in ()).throw(RuntimeError("db unavailable")))
    client = build_client()
    resp = client.get("/risk/p1")
    assert resp.status_code == 200
    assert resp.json()["patient_id"] == "p1"


def test_get_risk_invalid_id_maps_400(monkeypatch):
    def _raise(_: str):
        raise ValueError("Invalid patient_id format")

    monkeypatch.setattr("api.risk_routes.predict_patient_risk", _raise)
    client = build_client()
    resp = client.get("/risk/p1")
    assert resp.status_code == 400


def test_get_risk_not_found_maps_404(monkeypatch):
    def _raise(_: str):
        raise ValueError("patient not found")

    monkeypatch.setattr("api.risk_routes.predict_patient_risk", _raise)
    client = build_client()
    resp = client.get("/risk/p1")
    assert resp.status_code == 404


def test_get_risk_unknown_value_error_maps_422(monkeypatch):
    def _raise(_: str):
        raise ValueError("bad payload semantics")

    monkeypatch.setattr("api.risk_routes.predict_patient_risk", _raise)
    client = build_client()
    resp = client.get("/risk/p1")
    assert resp.status_code == 422


def test_get_risk_internal_error_maps_500(monkeypatch):
    def _raise(_: str):
        raise RuntimeError("db down")

    monkeypatch.setattr("api.risk_routes.predict_patient_risk", _raise)
    client = build_client()
    resp = client.get("/risk/p1")
    assert resp.status_code == 500


def test_get_risk_explain_success(monkeypatch):
    monkeypatch.setattr(
        "api.risk_routes.get_risk_with_explanation",
        lambda patient_id: {"patient_id": patient_id, "explanation": {"top_factors": []}},
    )
    client = build_client()
    resp = client.get("/risk/p1/explain")
    assert resp.status_code == 200
    assert "explanation" in resp.json()


def test_get_risk_explain_value_error_maps_404(monkeypatch):
    def _raise(_: str):
        raise ValueError("patient not found")

    monkeypatch.setattr("api.risk_routes.get_risk_with_explanation", _raise)
    client = build_client()
    resp = client.get("/risk/p1/explain")
    assert resp.status_code == 404


def test_get_risk_explain_internal_error_maps_500(monkeypatch):
    def _raise(_: str):
        raise RuntimeError("explain failed")

    monkeypatch.setattr("api.risk_routes.get_risk_with_explanation", _raise)
    client = build_client()
    resp = client.get("/risk/p1/explain")
    assert resp.status_code == 500
