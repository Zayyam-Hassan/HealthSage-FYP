from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.what_if_routes import router


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def _baseline_response(patient_id: str):
    return {
        "patient_id": patient_id,
        "baseline": {
            "risk_score": 0.2,
            "risk_label": "low",
            "features": {},
            "top_features": [],
        },
        "modifiable_fields": [],
        "generated_at": "2026-01-01T00:00:00Z",
    }


def _compare_response(patient_id: str):
    return {
        "patient_id": patient_id,
        "scenario_name": "test",
        "baseline": {"risk_score": 0.2, "risk_label": "low", "features": {}, "top_features": []},
        "scenario": {"risk_score": 0.4, "risk_label": "medium", "features": {}, "top_features": []},
        "changes": [],
        "risk_delta": {"absolute": 0.2, "relative_percent": 100.0, "direction": "up"},
        "analysis": {"summary": "", "drivers": [], "clinical_interpretation": "", "cautions": []},
        "requires_clinician_review": True,
    }


def test_baseline_success(monkeypatch):
    monkeypatch.setattr(
        "api.what_if_routes.build_baseline_response",
        lambda patient_id: _baseline_response(patient_id),
    )
    client = build_client()
    resp = client.get("/what-if/patients/pat1/baseline")
    assert resp.status_code == 200


def test_baseline_value_error_maps_422(monkeypatch):
    monkeypatch.setattr(
        "api.what_if_routes.build_baseline_response",
        lambda patient_id: (_ for _ in ()).throw(ValueError("Invalid patient_id")),
    )
    client = build_client()
    resp = client.get("/what-if/patients/pat1/baseline")
    assert resp.status_code == 422


def test_compare_empty_modifications_422():
    client = build_client()
    resp = client.post("/what-if/patients/pat1/compare", json={"modifications": {}})
    assert resp.status_code == 422


def test_compare_success(monkeypatch):
    monkeypatch.setattr(
        "api.what_if_routes.compare_patient_scenario",
        lambda patient_id, modifications, scenario_name=None: _compare_response(patient_id),
    )
    client = build_client()
    resp = client.post("/what-if/patients/pat1/compare", json={"modifications": {"BMI": 23}})
    assert resp.status_code == 200
    assert resp.json()["patient_id"] == "pat1"
