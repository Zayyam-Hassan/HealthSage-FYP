from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.compatibility_routes import router


class _Collection:
    def __init__(self, found: bool):
        self._found = found

    def find_one(self, _query):
        return {"_id": "x"} if self._found else None


class _DB:
    def __init__(self, patient_found: bool, medication_found: bool):
        self.patients = _Collection(patient_found)
        self.medications = _Collection(medication_found)


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_invalid_object_ids_400():
    client = build_client()
    resp = client.get("/compatibility/bad-id/also-bad")
    assert resp.status_code == 400


def test_patient_not_found_404(monkeypatch):
    monkeypatch.setattr("api.compatibility_routes.get_db", lambda: _DB(False, True))
    client = build_client()
    resp = client.get("/compatibility/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012")
    assert resp.status_code == 404


def test_medication_not_found_404(monkeypatch):
    monkeypatch.setattr("api.compatibility_routes.get_db", lambda: _DB(True, False))
    client = build_client()
    resp = client.get("/compatibility/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012")
    assert resp.status_code == 404


def test_compatibility_success(monkeypatch):
    monkeypatch.setattr("api.compatibility_routes.get_db", lambda: _DB(True, True))
    client = build_client()
    resp = client.get("/compatibility/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012")
    assert resp.status_code == 200
    assert "compatibility_score" in resp.json()
