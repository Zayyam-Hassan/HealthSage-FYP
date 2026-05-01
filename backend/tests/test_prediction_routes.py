from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.prediction_routes import router


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_graphsage_prefers_patient_id(monkeypatch):
    monkeypatch.setattr(
        "api.prediction_routes.predict_graphsage_by_mongo_id",
        lambda patient_id: {"patient_id": patient_id, "predicted_label": 1},
    )
    client = build_client()
    resp = client.get("/prediction/graphsage", params={"patient_id": "507f1f77bcf86cd799439011"})

    assert resp.status_code == 200
    assert resp.json()["predicted_label"] == 1


def test_graphsage_returns_400_when_no_inputs():
    client = build_client()
    resp = client.get("/prediction/graphsage")
    assert resp.status_code == 400
    assert "Provide either patient_id" in resp.json()["detail"]


def test_graphsage_returns_404_for_value_error(monkeypatch):
    def _raise(_: str):
        raise ValueError("Patient not found")

    monkeypatch.setattr("api.prediction_routes.predict_graphsage_by_mongo_id", _raise)
    client = build_client()
    resp = client.get("/prediction/graphsage", params={"patient_id": "507f1f77bcf86cd799439011"})
    assert resp.status_code == 404


def test_graphsage_returns_500_for_unexpected_error(monkeypatch):
    def _raise(_: str):
        raise RuntimeError("unexpected")

    monkeypatch.setattr("api.prediction_routes.predict_graphsage_by_mongo_id", _raise)
    client = build_client()
    resp = client.get("/prediction/graphsage", params={"patient_id": "507f1f77bcf86cd799439011"})
    assert resp.status_code == 500
    assert "unexpected" in resp.json()["detail"]


def test_graphsage_patient_uri_path(monkeypatch):
    monkeypatch.setattr(
        "api.prediction_routes.predict_graphsage_patient",
        lambda patient_uri, ttl_path: {"patient_uri": patient_uri, "ttl_path": ttl_path},
    )
    client = build_client()
    resp = client.get("/prediction/graphsage", params={"patient_uri": "patient:42"})
    assert resp.status_code == 200
    assert resp.json()["patient_uri"] == "patient:42"


def test_hgt_returns_500_for_unexpected_error(monkeypatch):
    def _raise(patient_uri: str, ttl_path: str):
        raise RuntimeError("boom")

    monkeypatch.setattr("api.prediction_routes.predict_hgt_patient", _raise)
    client = build_client()
    resp = client.get("/prediction/hgt", params={"patient_uri": "patient:1"})
    assert resp.status_code == 500
    assert "boom" in resp.json()["detail"]


def test_hgt_prefers_patient_id(monkeypatch):
    monkeypatch.setattr(
        "api.prediction_routes.predict_hgt_by_mongo_id",
        lambda patient_id: {"patient_id": patient_id, "predicted_label": 0},
    )
    client = build_client()
    resp = client.get("/prediction/hgt", params={"patient_id": "507f1f77bcf86cd799439011"})
    assert resp.status_code == 200
    assert resp.json()["predicted_label"] == 0


def test_hgt_returns_400_when_no_inputs():
    client = build_client()
    resp = client.get("/prediction/hgt")
    assert resp.status_code == 400


def test_hgt_returns_404_for_value_error(monkeypatch):
    def _raise(_: str):
        raise ValueError("Patient not found")

    monkeypatch.setattr("api.prediction_routes.predict_hgt_by_mongo_id", _raise)
    client = build_client()
    resp = client.get("/prediction/hgt", params={"patient_id": "507f1f77bcf86cd799439011"})
    assert resp.status_code == 404
