from services.prediction.service import (
    _convert_units_to_training_standard,
    _get_feature_meta,
    _get_threshold,
)


def test_get_threshold_prefers_metrics_threshold():
    artifacts = {
        "metrics": {"threshold_metrics": {"best_threshold": 0.77}},
        "config": {"best_threshold": 0.22},
    }
    assert _get_threshold(artifacts) == 0.77


def test_get_feature_meta_supports_nested_and_flat():
    flat = {"metrics": {"feature_meta": {"clinical_feature_names": ["A"]}}}
    nested = {"metrics": {"metrics": {"feature_meta": {"clinical_feature_names": ["B"]}}}}
    assert _get_feature_meta(flat)["clinical_feature_names"] == ["A"]
    assert _get_feature_meta(nested)["clinical_feature_names"] == ["B"]


def test_convert_units_handles_mixed_units_and_invalid_values():
    data = {
        "HBA1C": 53,  # mmol/mol -> %
        "FASTING_GLUCOSE": 5.5,  # mmol/L -> mg/dL
        "RANDOM_GLUCOSE": "bad",  # ignored
        "TOTAL_CHOLESTEROL": 210,  # mg/dL -> mmol/L
        "HDL": 50,
        "LDL": 120,
        "TRIGLYCERIDES": 150,
    }

    _convert_units_to_training_standard(data)

    assert 6.9 < data["HBA1C"] < 7.1
    assert 99 < data["FASTING_GLUCOSE"] < 100
    assert data["RANDOM_GLUCOSE"] == "bad"
    assert 5.3 < data["TOTAL_CHOLESTEROL"] < 5.6
