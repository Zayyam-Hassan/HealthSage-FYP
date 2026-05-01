from services.risk.prediction_service import _score_to_label, predict_patient_risk


def test_score_to_label_boundaries():
    assert _score_to_label(0.1) == "low"
    assert _score_to_label(0.3) == "medium"
    assert _score_to_label(0.7) == "high"


def test_predict_patient_risk_maps_prediction_output(monkeypatch):
    monkeypatch.setattr(
        "services.risk.prediction_service.predict_graphsage_by_mongo_id",
        lambda patient_id: {"probability": 0.81, "predicted_label": 1},
    )

    result = predict_patient_risk("507f1f77bcf86cd799439011")
    assert result["patient_id"] == "507f1f77bcf86cd799439011"
    assert result["risk_score"] == 0.81
    assert result["risk_label"] == "high"
    assert result["predicted_label"] == 1
    assert result["model_name"] == "GraphSAGE"
    assert result["explanation_available"] is True


def test_predict_patient_risk_defaults_when_keys_missing(monkeypatch):
    monkeypatch.setattr(
        "services.risk.prediction_service.predict_graphsage_by_mongo_id",
        lambda patient_id: {},
    )

    result = predict_patient_risk("p1")
    assert result["risk_score"] == 0.0
    assert result["predicted_label"] == 0
    assert result["risk_label"] == "low"
