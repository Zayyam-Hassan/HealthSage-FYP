from __future__ import annotations

from difflib import SequenceMatcher
import re
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from services.prediction.service import (
    build_graphsage_patient_data,
    get_patient_actual_metrics,
    predict_graphsage_from_patient_data,
)
from services.risk.graph_explainer import explain_risk_from_patient_data

FIELD_CONFIG: Dict[str, Dict[str, Any]] = {
    "hba1c": {"model_key": "HBA1C", "label": "HbA1c", "unit": "%", "min": 3.0, "max": 18.0},
    "fasting_glucose": {
        "model_key": "FASTING_GLUCOSE",
        "label": "Fasting glucose",
        "unit": "mg/dL",
        "min": 40.0,
        "max": 500.0,
    },
    "glucose": {
        "model_key": "RANDOM_GLUCOSE",
        "label": "Glucose",
        "unit": "mg/dL",
        "min": 40.0,
        "max": 600.0,
    },
    "bmi": {"model_key": "BMI", "label": "BMI", "unit": "kg/m2", "min": 10.0, "max": 80.0},
    "systolic_bp": {
        "model_key": "SYSTOLIC_BP",
        "label": "Systolic BP",
        "unit": "mmHg",
        "min": 60.0,
        "max": 260.0,
    },
    "diastolic_bp": {
        "model_key": "DIASTOLIC_BP",
        "label": "Diastolic BP",
        "unit": "mmHg",
        "min": 30.0,
        "max": 160.0,
    },
    "cholesterol": {
        "model_key": "TOTAL_CHOLESTEROL",
        "label": "Total cholesterol",
        "unit": "mg/dL",
        "min": 80.0,
        "max": 500.0,
    },
    "hdl": {"model_key": "HDL", "label": "HDL", "unit": "mg/dL", "min": 10.0, "max": 150.0},
    "ldl": {"model_key": "LDL", "label": "LDL", "unit": "mg/dL", "min": 10.0, "max": 400.0},
    "triglycerides": {
        "model_key": "TRIGLYCERIDES",
        "label": "Triglycerides",
        "unit": "mg/dL",
        "min": 20.0,
        "max": 1500.0,
    },
    "age": {"model_key": "AGE", "label": "Age", "unit": "years", "min": 1.0, "max": 120.0},
    "sex": {"model_key": "SEX", "label": "Sex", "input_type": "text"},
    "height_cm": {
        "model_key": "HEIGHT_CM",
        "label": "Height",
        "unit": "cm",
        "min": 80.0,
        "max": 250.0,
    },
    "weight_kg": {
        "model_key": "WEIGHT_KG",
        "label": "Weight",
        "unit": "kg",
        "min": 20.0,
        "max": 350.0,
    },
}

FIELD_ALIASES: Dict[str, str] = {
    "hba1c": "hba1c",
    "hbaic": "hba1c",
    "hbac1": "hba1c",
    "hb a1c": "hba1c",
    "a1c": "hba1c",
    "glucose": "glucose",
    "random glucose": "glucose",
    "blood glucose": "glucose",
    "fasting glucose": "fasting_glucose",
    "fbs": "fasting_glucose",
    "bmi": "bmi",
    "body mass index": "bmi",
    "systolic bp": "systolic_bp",
    "systolic blood pressure": "systolic_bp",
    "diastolic bp": "diastolic_bp",
    "diastolic blood pressure": "diastolic_bp",
    "cholesterol": "cholesterol",
    "total cholesterol": "cholesterol",
    "hdl": "hdl",
    "ldl": "ldl",
    "triglycerides": "triglycerides",
    "trigs": "triglycerides",
    "age": "age",
    "sex": "sex",
    "height": "height_cm",
    "height cm": "height_cm",
    "weight": "weight_kg",
    "weight kg": "weight_kg",
}

SORTED_ALIASES = sorted(FIELD_ALIASES.keys(), key=len, reverse=True)
NUMBER_PATTERN = re.compile(r"([-+]?\d+(?:\.\d+)?)")


def risk_label(score: float) -> str:
    if score < 0.3:
        return "low"
    if score < 0.7:
        return "medium"
    return "high"


def normalize_prediction(raw: Dict[str, Any]) -> Tuple[float, str]:
    score = float(raw.get("probability", 0.0))
    return score, risk_label(score)


def to_public_features(patient_data: Dict[str, Any]) -> Dict[str, Any]:
    public: Dict[str, Any] = {}
    for field, config in FIELD_CONFIG.items():
        public[field] = patient_data.get(config["model_key"])
    return public


def to_modifiable_fields(patient_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    fields: List[Dict[str, Any]] = []
    for field, config in FIELD_CONFIG.items():
        fields.append(
            {
                "field": field,
                "label": config["label"],
                "unit": config.get("unit"),
                "min_value": config.get("min"),
                "max_value": config.get("max"),
                "input_type": config.get("input_type", "number"),
                "baseline_value": patient_data.get(config["model_key"]),
            }
        )
    return fields


def validate_value(field: str, value: Any) -> Any:
    config = FIELD_CONFIG[field]
    if config.get("input_type") == "text":
        normalized = str(value).strip().lower()
        if normalized not in {"male", "female", "other", "m", "f", "0", "1"}:
            raise ValueError(f"Invalid value for {field}")
        if normalized in {"m", "1"}:
            return "Male"
        if normalized in {"f", "0"}:
            return "Female"
        return normalized.capitalize()

    numeric = float(value)
    min_value = config.get("min")
    max_value = config.get("max")
    if min_value is not None and numeric < float(min_value):
        raise ValueError(f"{field} must be at least {min_value}")
    if max_value is not None and numeric > float(max_value):
        raise ValueError(f"{field} must be at most {max_value}")
    return numeric


def apply_modifications(patient_data: Dict[str, Any], modifications: Dict[str, Any]) -> Dict[str, Any]:
    updated = deepcopy(patient_data)
    for field, value in modifications.items():
        config = FIELD_CONFIG.get(field)
        if not config:
            raise ValueError(f"Unsupported modification field: {field}")
        updated[config["model_key"]] = validate_value(field, value)
    return updated


def build_snapshot(
    model_patient_data: Dict[str, Any],
    raw_prediction: Dict[str, Any],
    display_patient_data: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    score, label = normalize_prediction(raw_prediction)
    explanation = explain_risk_from_patient_data(
        model_patient_data,
        {"risk_score": score, "risk_label": label},
    )
    return {
        "risk_score": round(score, 4),
        "risk_label": label,
        "features": to_public_features(display_patient_data or model_patient_data),
        "top_features": explanation.get("top_features", []),
    }


def build_analysis(
    baseline: Dict[str, Any],
    scenario: Dict[str, Any],
    changes: List[Dict[str, Any]],
) -> Dict[str, Any]:
    summary = (
        f"Scenario risk changed from {baseline['risk_label']} ({baseline['risk_score']:.2f}) "
        f"to {scenario['risk_label']} ({scenario['risk_score']:.2f})."
    )
    drivers = [
        f"{change['label']} changed from {change['baseline_value']} to {change['scenario_value']}."
        for change in changes[:4]
    ]
    score_delta = float(scenario["risk_score"]) - float(baseline["risk_score"])
    if score_delta < 0:
        interpretation = (
            "The modified scenario reduced the modeled diabetes risk. This reflects the updated "
            "feature profile passed through the same GraphSAGE inference path used for live prediction."
        )
    elif score_delta > 0:
        interpretation = (
            "The modified scenario increased the modeled diabetes risk. The comparison reflects a real "
            "re-run of the current GraphSAGE prediction path using the edited scenario inputs."
        )
    else:
        interpretation = "The modified scenario did not materially change the modeled diabetes risk."

    return {
        "summary": summary,
        "drivers": drivers,
        "clinical_interpretation": interpretation,
        "cautions": [
            "What-if analysis is a temporary simulation and does not overwrite the patient record.",
            "Results reflect the current GraphSAGE model and should be reviewed clinically before acting on them.",
        ],
    }


def build_baseline_response(patient_id: str) -> Dict[str, Any]:
    patient_data = build_graphsage_patient_data(patient_id)
    actual_metrics = get_patient_actual_metrics(patient_id)
    baseline_raw = predict_graphsage_from_patient_data(patient_data, patient_id=patient_id)
    return {
        "patient_id": patient_id,
        "baseline": build_snapshot(patient_data, baseline_raw, display_patient_data=actual_metrics),
        "modifiable_fields": to_modifiable_fields(actual_metrics),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def compare_patient_scenario(
    patient_id: str,
    modifications: Dict[str, Any],
    scenario_name: str | None = None,
) -> Dict[str, Any]:
    if not modifications:
        raise ValueError("modifications must not be empty")

    model_patient_data = build_graphsage_patient_data(patient_id)
    actual_metrics = get_patient_actual_metrics(patient_id)
    baseline_raw = predict_graphsage_from_patient_data(model_patient_data, patient_id=patient_id)
    scenario_model_data = apply_modifications(model_patient_data, modifications)
    scenario_display_data = apply_modifications(actual_metrics, modifications)
    scenario_raw = predict_graphsage_from_patient_data(scenario_model_data, patient_id=patient_id)

    baseline = build_snapshot(
        model_patient_data,
        baseline_raw,
        display_patient_data=actual_metrics,
    )
    scenario = build_snapshot(
        scenario_model_data,
        scenario_raw,
        display_patient_data=scenario_display_data,
    )
    changes = [
        {
            "feature": field,
            "label": FIELD_CONFIG[field]["label"],
            "baseline_value": baseline["features"].get(field),
            "scenario_value": scenario["features"].get(field),
            "unit": FIELD_CONFIG[field].get("unit"),
        }
        for field in modifications.keys()
    ]

    absolute = round(float(scenario["risk_score"]) - float(baseline["risk_score"]), 4)
    relative = 0.0
    if float(baseline["risk_score"]) != 0:
        relative = round((absolute / float(baseline["risk_score"])) * 100, 2)
    direction = "decrease" if absolute < 0 else "increase" if absolute > 0 else "no_change"

    return {
        "patient_id": patient_id,
        "scenario_name": scenario_name,
        "baseline": baseline,
        "scenario": scenario,
        "changes": changes,
        "risk_delta": {
            "absolute": absolute,
            "relative_percent": relative,
            "direction": direction,
        },
        "analysis": build_analysis(baseline, scenario, changes),
        "requires_clinician_review": True,
    }


def _match_alias_fuzzy(candidate: str) -> str | None:
    normalized = " ".join(candidate.strip().lower().split())
    if not normalized:
        return None
    if normalized in FIELD_ALIASES:
        return FIELD_ALIASES[normalized]

    best_alias = None
    best_score = 0.0
    for alias in FIELD_ALIASES:
        score = SequenceMatcher(None, normalized, alias).ratio()
        if score > best_score:
            best_alias = alias
            best_score = score

    if best_alias and best_score >= 0.72:
        return FIELD_ALIASES[best_alias]
    return None


def _extract_fuzzy_number_changes(normalized: str) -> Dict[str, Any]:
    changes: Dict[str, Any] = {}
    tokens = normalized.split()
    if not tokens:
        return changes

    for index, token in enumerate(tokens):
        if not NUMBER_PATTERN.fullmatch(token):
            continue

        for window_size in (3, 2, 1):
            start = max(0, index - window_size)
            phrase_tokens = [
                part
                for part in tokens[start:index]
                if part not in {"to", "up", "upto", "upto", "goes", "go", "is", "if", "analysis", "simulate", "risk", "what"}
            ]
            if not phrase_tokens:
                continue
            candidate = " ".join(phrase_tokens)
            canonical = _match_alias_fuzzy(candidate)
            if not canonical or canonical in changes:
                continue
            try:
                changes[canonical] = validate_value(canonical, token)
                break
            except Exception:
                continue

        if len(changes) >= 6:
            break

    return changes


def extract_what_if_changes(text: str | None) -> Dict[str, Any]:
    if not text:
        return {}

    normalized = " ".join(str(text).strip().lower().split())
    changes: Dict[str, Any] = {}

    for alias in SORTED_ALIASES:
        canonical = FIELD_ALIASES[alias]
        escaped = re.escape(alias)
        patterns = [
            rf"\b{escaped}\b\s*(?:go(?:es)?\s+(?:up|down)\s+to|to|at|=|becomes?|be|would be|is|up\s*to|upto)\s*([-+]?\d+(?:\.\d+)?)",
            rf"\b{escaped}\b[^\d\-+]{0,25}([-+]?\d+(?:\.\d+)?)",
        ]
        for pattern in patterns:
            match = re.search(pattern, normalized, flags=re.IGNORECASE)
            if match:
                raw_value = match.group(1)
                try:
                    changes[canonical] = validate_value(canonical, raw_value)
                except Exception:
                    pass
                break

    sex_match = re.search(r"\bsex\b\s*(?:to|=|becomes?|is)\s*(male|female|other|m|f)\b", normalized)
    if sex_match:
        try:
            changes["sex"] = validate_value("sex", sex_match.group(1))
        except Exception:
            pass

    if not changes:
        changes.update(_extract_fuzzy_number_changes(normalized))

    return changes
