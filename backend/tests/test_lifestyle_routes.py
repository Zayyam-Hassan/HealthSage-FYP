from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.lifestyle_routes import router


class _InsertResult:
    inserted_id = "507f1f77bcf86cd799439099"


class _LifestyleCollection:
    def insert_one(self, _doc):
        return _InsertResult()


class _DB:
    lifestyle_recommendations = _LifestyleCollection()


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


async def _fake_generate(_patient_id: str):
    return {"plan": {"diet": "balanced"}}


def test_lifestyle_success(monkeypatch):
    monkeypatch.setattr(
        "api.lifestyle_routes.generate_and_store_lifestyle_recs_async",
        _fake_generate,
    )
    client = build_client()
    resp = client.post("/recommendations/lifestyle/507f1f77bcf86cd799439011")
    assert resp.status_code == 200
    assert "plan" in resp.json()


def test_lifestyle_store_success(monkeypatch):
    monkeypatch.setattr(
        "api.lifestyle_routes.generate_and_store_lifestyle_recs_async",
        _fake_generate,
    )
    monkeypatch.setattr("api.lifestyle_routes.get_db", lambda: _DB())
    client = build_client()
    resp = client.post("/recommendations/lifestyle/507f1f77bcf86cd799439011?store=true")
    assert resp.status_code == 200
    assert "recommendation_id" in resp.json()
