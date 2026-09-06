import types
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.explain_routes import router


def build_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_explain_risk_success_without_store(monkeypatch):
    fake_module = types.SimpleNamespace(
        run_explain_risk=lambda patient_id, model_type: {
            "patient_id": patient_id,
            "model_type": model_type,
            "risk_prediction": 0.3,
            "risk_label": "Low Risk",
            "top_features": [],
            "important_nodes": [],
            "important_relationships": [],
            "reasoning_paths": [],
            "visual_subgraph": {"nodes": [], "edges": []},
        }
    )
    monkeypatch.setitem(sys.modules, "services.explainability", fake_module)
    client = build_client()
    resp = client.post("/explain-risk?store=false", json={"patient_id": "507f1f77bcf86cd799439011"})
    assert resp.status_code == 200
    assert "prediction" in resp.json()


def test_explain_risk_value_error_422(monkeypatch):
    fake_module = types.SimpleNamespace(
        run_explain_risk=lambda patient_id, model_type: (_ for _ in ()).throw(ValueError("invalid")),
    )
    monkeypatch.setitem(sys.modules, "services.explainability", fake_module)
    client = build_client()
    resp = client.post("/explain-risk?store=false", json={"patient_id": "507f1f77bcf86cd799439011"})
    assert resp.status_code == 422


def test_explain_risk_internal_error_500(monkeypatch):
    fake_module = types.SimpleNamespace(
        run_explain_risk=lambda patient_id, model_type: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    monkeypatch.setitem(sys.modules, "services.explainability", fake_module)
    client = build_client()
    resp = client.post("/explain-risk?store=false", json={"patient_id": "507f1f77bcf86cd799439011"})
    assert resp.status_code == 500
