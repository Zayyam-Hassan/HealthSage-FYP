"""
Populate HealthSage ontology ABox from four tabular datasets (clean + correct).

What this script does (correctly):
- Loads your existing TBox from ontology.owl (RDF/XML) into an rdflib Graph.
- Fixes the OWL entity issue (&xsd;string etc.) in-memory (does not modify the file).
- Normalizes dataset column names (lowercase, strip, spaces -> underscores).
- Creates ObservationDefinition individuals:
  - For known clinical fields (HbA1c, glucose, BP, BMI, etc.) with units + ranges.
  - For extra demographic/lifestyle columns present in datasets 2/3/4 as dynamic ObsDefs.
- Populates Patients with core demographics directly on Patient:
  - age, sex, heightCm, weightKg
- Populates ALL other fields (except identifiers and label columns) as Observations:
  Patient -> hasObservation -> Observation -> instanceOf -> ObservationDefinition
- Handles labels correctly:
  - Creates Diabetes/Hypertension/etc Condition ONLY when label indicates positive.
  - Stores the raw label as an Observation (DIABETES_LABEL / HYPERTENSION_LABEL / etc.) to preserve negatives too.
- Converts dataset4 glucose from mmol/L to mg/dL (x18).
- Serializes combined graph (TBox + ABox) to output/healthsage_abox.ttl.

Usage:
  python scripts/populate_ontology.py --data_dir Datasets \
    --ontology ontology.owl \
    --d1 "Dataset of Diabetes .csv" \
    --d2 "diabetes_prediction_dataset.csv" \
    --d3 "diabetes_clean.csv" \
    --d4 "DiaBD_A Diabetes Dataset for Enhanced Risk Analysis and Research in Bangladesh.csv"
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from dataclasses import dataclass
from typing import Dict, Iterable, Optional, Tuple, Any

import pandas as pd
from rdflib import Graph, Literal, Namespace, RDF, URIRef
from rdflib.namespace import XSD

BASE_URI = "http://healthsage.org/ontology#"
HS = Namespace(BASE_URI)

# -----------------------------
# Helpers: ids, parsing, cleaning
# -----------------------------
def sha1_hex(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()

def safe_obs_code(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^\w]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        s = "unnamed"
    return s.upper()

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = (
        df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.replace(" ", "_", regex=False)
        .str.replace("-", "_", regex=False)
        .str.replace("/", "_", regex=False)
    )
    df.columns = df.columns.str.replace(r"[(){}\[\]]", "", regex=True)
    df.columns = df.columns.str.replace(r"__+", "_", regex=True).str.strip("_")
    return df

def is_nan(v: Any) -> bool:
    return v is None or (isinstance(v, float) and pd.isna(v)) or (isinstance(v, pd._libs.missing.NAType))

def parse_float(v: Any) -> Optional[float]:
    if is_nan(v):
        return None
    s = str(v).strip()
    if not s:
        return None
    # remove common adornments
    s = s.replace(",", "")
    s = s.replace("<", "").replace(">", "")
    s = s.replace("%", "")
    try:
        return float(s)
    except ValueError:
        return None

def normalize_sex(v: Any) -> Optional[str]:
    if is_nan(v):
        return None
    s = str(v).strip().lower()
    if not s:
        return None
    if s in {"m", "male", "man"}:
        return "Male"
    if s in {"f", "female", "woman"}:
        return "Female"
    # dataset sometimes has "0/1"
    if s in {"1"}:
        return "Male"
    if s in {"0"}:
        return "Female"
    return None

def parse_bool01(v: Any) -> Optional[int]:
    """Return 1/0 if recognizable, else None."""
    if is_nan(v):
        return None
    s = str(v).strip().lower()
    if not s:
        return None
    if s in {"1", "true", "t", "yes", "y", "positive", "diabetic"}:
        return 1
    if s in {"0", "false", "f", "no", "n", "negative", "non_diabetic", "normal"}:
        return 0
    return None

# -----------------------------
# Known ObsDef config (clinical/vitals)
# -----------------------------
@dataclass(frozen=True)
class ObsDef:
    category: str
    value_type: str
    unit_expected: str
    valid_min: Optional[float] = None
    valid_max: Optional[float] = None

KNOWN_OBSDEFS: Dict[str, ObsDef] = {
    "BMI": ObsDef("vital", "float", "kg/m2", 10.0, 80.0),
    "UREA": ObsDef("lab", "float", "", None, None),
    "CREATININE": ObsDef("lab", "float", "", None, None),
    "HBA1C": ObsDef("lab", "float", "%", 3.0, 20.0),
    "CHOLESTEROL_TOTAL": ObsDef("lab", "float", "", None, None),
    "TRIGLYCERIDES": ObsDef("lab", "float", "", None, None),
    "HDL": ObsDef("lab", "float", "", None, None),
    "LDL": ObsDef("lab", "float", "", None, None),
    "VLDL": ObsDef("lab", "float", "", None, None),
    "HEMOGLOBIN": ObsDef("lab", "float", "", None, None),
    "RANDOM_GLUCOSE": ObsDef("lab", "float", "mg/dL", 30.0, 600.0),
    "FASTING_GLUCOSE": ObsDef("lab", "float", "mg/dL", 30.0, 600.0),
    "SMOKING_STATUS": ObsDef("lifestyle", "string", "", None, None),
    "PULSE_RATE": ObsDef("vital", "float", "bpm", None, None),
    "BLOOD_PRESSURE_SYSTOLIC": ObsDef("vital", "float", "mmHg", 60.0, 260.0),
    "BLOOD_PRESSURE_DIASTOLIC": ObsDef("vital", "float", "mmHg", 30.0, 160.0),
    "HEIGHT_M": ObsDef("vital", "float", "m", None, None),
    "WEIGHT_KG": ObsDef("vital", "float", "kg", None, None),
    "FAMILY_DIABETES": ObsDef("demographic", "bool", "", None, None),
    "FAMILY_HYPERTENSION": ObsDef("demographic", "bool", "", None, None),
    # label preservation (so negatives are stored without creating conditions)
    "DIABETES_LABEL": ObsDef("label", "bool", "", None, None),
    "HYPERTENSION_LABEL": ObsDef("label", "bool", "", None, None),
    "HEART_DISEASE_LABEL": ObsDef("label", "bool", "", None, None),
    "CARDIOVASCULAR_DISEASE_LABEL": ObsDef("label", "bool", "", None, None),
    "STROKE_LABEL": ObsDef("label", "bool", "", None, None),
}

AGE_RANGE = (1, 120)

# -----------------------------
# OWL loading (fix undefined XML entities)
# -----------------------------
def load_ontology_graph(ontology_path: str) -> Graph:
    if not os.path.exists(ontology_path):
        print(f"ERROR: Ontology file not found: {ontology_path}", file=sys.stderr)
        sys.exit(1)

    with open(ontology_path, "r", encoding="utf-8") as f:
        data = f.read()

    # Your OWL uses "&xsd;string" style which is an XML entity (needs DOCTYPE) not a namespace prefix.
    # We patch it in-memory to valid absolute IRIs.
    fixed = data.replace("&xsd;", "http://www.w3.org/2001/XMLSchema#")

    g = Graph()
    g.bind("hs", HS)
    g.parse(data=fixed, format="xml")
    return g

# -----------------------------
# RDF: ensure ObsDef exists
# -----------------------------
def obsdef_uri(obs_code: str) -> URIRef:
    return HS[f"ObsDef_{obs_code}"]

def ensure_obsdef(graph: Graph, obs_code: str, definition: ObsDef, display_name: Optional[str] = None) -> None:
    uri = obsdef_uri(obs_code)
    # If already present, do nothing
    if (uri, RDF.type, HS.ObservationDefinition) in graph:
        return

    graph.add((uri, RDF.type, HS.ObservationDefinition))
    graph.add((uri, HS.obsCode, Literal(obs_code, datatype=XSD.string)))
    graph.add((uri, HS.displayName, Literal(display_name or obs_code.replace("_", " "), datatype=XSD.string)))
    graph.add((uri, HS.category, Literal(definition.category, datatype=XSD.string)))
    graph.add((uri, HS.valueType, Literal(definition.value_type, datatype=XSD.string)))
    if definition.unit_expected:
        graph.add((uri, HS.unitExpected, Literal(definition.unit_expected, datatype=XSD.string)))
    if definition.valid_min is not None:
        graph.add((uri, HS.validMin, Literal(float(definition.valid_min), datatype=XSD.decimal)))
    if definition.valid_max is not None:
        graph.add((uri, HS.validMax, Literal(float(definition.valid_max), datatype=XSD.decimal)))

def infer_dynamic_obsdef(column: str, sample_values: Iterable[Any]) -> ObsDef:
    col = column.lower()
    category = "dataset_feature"
    if any(k in col for k in ["smok", "exercise", "activity", "diet", "alcohol", "sleep"]):
        category = "lifestyle"
    elif any(k in col for k in ["income", "education", "marital", "occupation", "employ", "region", "city", "ethnic", "race"]):
        category = "demographic"
    elif any(k in col for k in ["history", "family", "parent"]):
        category = "demographic"

    # infer type from sample
    numeric_count = 0
    boolish_count = 0
    total = 0
    for v in sample_values:
        if is_nan(v):
            continue
        total += 1
        if parse_float(v) is not None:
            numeric_count += 1
        b = parse_bool01(v)
        if b is not None:
            boolish_count += 1

    if total == 0:
        return ObsDef(category, "string", "")
    # bool dominates if most values are boolish
    if boolish_count / total >= 0.8:
        return ObsDef(category, "bool", "")
    # numeric dominates
    if numeric_count / total >= 0.8:
        return ObsDef(category, "float", "")
    return ObsDef(category, "string", "")

# -----------------------------
# RDF: Patients, Observations, Conditions
# -----------------------------
def patient_uri(patient_id: str) -> URIRef:
    return HS[f"Patient_{patient_id}"]

def create_or_get_patient(graph: Graph, patient_id: str) -> URIRef:
    uri = patient_uri(patient_id)
    if (uri, RDF.type, HS.Patient) not in graph:
        graph.add((uri, RDF.type, HS.Patient))
        graph.add((uri, HS.patientId, Literal(patient_id, datatype=XSD.string)))
    return uri

def set_patient_demographics(
    graph: Graph,
    uri: URIRef,
    sex: Optional[str],
    age_val: Optional[float],
    height_cm: Optional[float] = None,
    weight_kg: Optional[float] = None,
) -> None:
    if sex:
        graph.set((uri, HS.sex, Literal(sex, datatype=XSD.string)))
    if age_val is not None and AGE_RANGE[0] <= age_val <= AGE_RANGE[1]:
        graph.set((uri, HS.age, Literal(int(round(age_val)), datatype=XSD.integer)))
    if height_cm is not None:
        graph.set((uri, HS.heightCm, Literal(float(height_cm), datatype=XSD.decimal)))
    if weight_kg is not None:
        graph.set((uri, HS.weightKg, Literal(float(weight_kg), datatype=XSD.decimal)))

def in_range(obs_code: str, v: float) -> bool:
    d = KNOWN_OBSDEFS.get(obs_code)
    if not d:
        return True
    if d.valid_min is not None and v < d.valid_min:
        return False
    if d.valid_max is not None and v > d.valid_max:
        return False
    return True

def create_observation(
    graph: Graph,
    patient: URIRef,
    patient_id: str,
    dataset_name: str,
    obs_code: str,
    source_column: str,
    row_index: int,
    value_numeric: Optional[float] = None,
    value_text: Optional[str] = None,
    unit: Optional[str] = None,
) -> None:
    if value_numeric is None and (value_text is None or value_text == ""):
        return
    if value_numeric is not None and not in_range(obs_code, value_numeric):
        return

    obs_id = sha1_hex(f"{patient_id}|{dataset_name}|{obs_code}|{source_column}|{row_index}")
    obs_uri = HS[f"Obs_{obs_id}"]

    graph.add((obs_uri, RDF.type, HS.Observation))
    graph.add((obs_uri, HS.observationId, Literal(obs_id, datatype=XSD.string)))
    if value_numeric is not None:
        graph.add((obs_uri, HS.valueNumeric, Literal(float(value_numeric), datatype=XSD.decimal)))
    if value_text is not None and value_text != "":
        graph.add((obs_uri, HS.valueText, Literal(value_text, datatype=XSD.string)))
    if unit:
        graph.add((obs_uri, HS.unit, Literal(unit, datatype=XSD.string)))

    graph.add((obs_uri, HS.sourceType, Literal("dataset", datatype=XSD.string)))
    graph.add((obs_uri, HS.sourceId, Literal(dataset_name, datatype=XSD.string)))
    graph.add((obs_uri, HS.sourceColumn, Literal(source_column, datatype=XSD.string)))

    graph.add((obs_uri, HS.instanceOf, obsdef_uri(obs_code)))
    graph.add((patient, HS.hasObservation, obs_uri))

def create_condition(
    graph: Graph,
    patient: URIRef,
    patient_id: str,
    dataset_name: str,
    condition_name: str,
    status: str = "active",
) -> None:
    cond_id = sha1_hex(f"{patient_id}|{dataset_name}|{condition_name}")
    cond_uri = HS[f"Cond_{cond_id}"]
    graph.add((cond_uri, RDF.type, HS.Condition))
    graph.add((cond_uri, HS.conditionId, Literal(cond_id, datatype=XSD.string)))
    graph.add((cond_uri, HS.conditionName, Literal(condition_name, datatype=XSD.string)))
    graph.add((cond_uri, HS.conditionStatus, Literal(status, datatype=XSD.string)))
    graph.add((patient, HS.hasCondition, cond_uri))

# -----------------------------
# Dataset processing
# -----------------------------
def load_csv(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        print(f"ERROR: Missing dataset file: {path}", file=sys.stderr)
        sys.exit(1)
    df = pd.read_csv(path)
    return normalize_columns(df)

def ensure_known_obsdefs(graph: Graph) -> None:
    for code, d in KNOWN_OBSDEFS.items():
        ensure_obsdef(graph, code, d)

def build_dynamic_obsdefs_for_df(graph: Graph, dataset_name: str, df: pd.DataFrame) -> Dict[str, str]:
    """
    For extra columns not part of known mappings/identifiers/labels, create dynamic ObsDefs.
    Returns mapping: column -> obs_code
    """
    col_to_obscode: Dict[str, str] = {}
    # sample up to 200 rows for type inference
    sample_df = df.head(200)

    for col in df.columns:
        # skip obvious id columns
        if col in {"id", "no_pation", "patient_id", "subject_id"}:
            continue
        # skip demographics that we place directly on Patient
        if col in {"age", "gender", "sex"}:
            continue
        # skip label columns (handled separately)
        if col in {"class", "is_diabetic", "diabetes", "diabetic", "hypertension", "hypertensive", "heart_disease",
                   "cardiovascular_disease", "stroke"}:
            continue

        # skip columns already handled as known clinical/vital fields by fixed mappings (we still keep them as known)
        # We do not dynamic-define for these because we use canonical obs_codes.
        if col in {
            "urea", "cr", "creatinine", "hba1c", "hba1c_level", "hba1clevel", "chol", "tg", "hdl", "ldl", "vldl",
            "bmi", "bmi_score", "haemoglobin_level", "hemoglobin_level", "blood_glucose_level", "glucose",
            "pulse_rate", "systolic_bp", "diastolic_bp", "height", "weight",
            "family_diabetes", "family_hypertension", "smoking_history"
        }:
            continue

        dyn_code = safe_obs_code(f"{dataset_name}__{col}")
        definition = infer_dynamic_obsdef(col, sample_df[col].tolist())
        ensure_obsdef(graph, dyn_code, definition, display_name=f"{dataset_name}: {col}")
        col_to_obscode[col] = dyn_code

    return col_to_obscode

def process_dataset1(graph: Graph, df: pd.DataFrame) -> Tuple[int, int, int]:
    """
    Dataset-1 sample columns:
    id, no_pation, gender, age, urea, cr, hba1c, chol, tg, hdl, ldl, vldl, bmi, class
    """
    dataset_name = "dataset1"
    patients = observations = conditions = 0

    for i, row in df.iterrows():
        pid_raw = row.get("id")
        if is_nan(pid_raw):
            continue
        # prefix to avoid collisions
        patient_id = f"d1_{str(pid_raw).strip()}"
        patient = create_or_get_patient(graph, patient_id)
        patients += 1

        sex = normalize_sex(row.get("gender"))
        age = parse_float(row.get("age"))
        set_patient_demographics(graph, patient, sex, age)

        # Known observations
        mapping = [
            ("UREA", "urea", row.get("urea"), None),
            ("CREATININE", "cr", row.get("cr"), None),
            ("HBA1C", "hba1c", row.get("hba1c"), "%"),
            ("CHOLESTEROL_TOTAL", "chol", row.get("chol"), None),
            ("TRIGLYCERIDES", "tg", row.get("tg"), None),
            ("HDL", "hdl", row.get("hdl"), None),
            ("LDL", "ldl", row.get("ldl"), None),
            ("VLDL", "vldl", row.get("vldl"), None),
            ("BMI", "bmi", row.get("bmi"), "kg/m2"),
        ]
        for code, col, raw, unit in mapping:
            v = parse_float(raw)
            if v is None:
                continue
            create_observation(graph, patient, patient_id, dataset_name, code, col, i, value_numeric=v, unit=unit)
            observations += 1

        # Label: class
        class_val = row.get("class")
        # Always preserve label as observation (0/1)
        is_pos = 0
        if not is_nan(class_val):
            s = str(class_val).strip().lower()
            if s in {"y", "p", "1", "yes", "diabetic", "true"}:
                is_pos = 1
        create_observation(graph, patient, patient_id, dataset_name, "DIABETES_LABEL", "class", i, value_numeric=float(is_pos))
        observations += 1

        # Create Diabetes condition only if positive
        if is_pos == 1:
            create_condition(graph, patient, patient_id, dataset_name, "Diabetes", status="active")
            conditions += 1

    return patients, observations, conditions

def process_dataset2(graph: Graph, df: pd.DataFrame, dyn_map: Dict[str, str]) -> Tuple[int, int, int]:
    """
    Dataset-2 sample columns:
    gender, age, hypertension, heart_disease, smoking_history, bmi_score, haemoglobin_level, blood_glucose_level, is_diabetic
    """
    dataset_name = "dataset2"
    patients = observations = conditions = 0

    for i, row in df.iterrows():
        patient_id = f"d2_{sha1_hex(f'{dataset_name}|{i}')}"
        patient = create_or_get_patient(graph, patient_id)
        patients += 1

        sex = normalize_sex(row.get("gender"))
        age = parse_float(row.get("age"))
        set_patient_demographics(graph, patient, sex, age)

        # Known observations
        bmi = parse_float(row.get("bmi_score"))
        if bmi is not None:
            create_observation(graph, patient, patient_id, dataset_name, "BMI", "bmi_score", i, value_numeric=bmi, unit="kg/m2")
            observations += 1

        # haemoglobin may be spelled both ways
        hb = parse_float(row.get("haemoglobin_level"))
        if hb is None:
            hb = parse_float(row.get("hemoglobin_level"))
        if hb is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HEMOGLOBIN", "haemoglobin_level", i, value_numeric=hb)
            observations += 1

        glu = parse_float(row.get("blood_glucose_level"))
        if glu is not None:
            create_observation(graph, patient, patient_id, dataset_name, "RANDOM_GLUCOSE", "blood_glucose_level", i, value_numeric=glu, unit="mg/dL")
            observations += 1

        smoking = row.get("smoking_history")
        if not is_nan(smoking):
            st = str(smoking).strip()
            if st:
                create_observation(graph, patient, patient_id, dataset_name, "SMOKING_STATUS", "smoking_history", i, value_text=st)
                observations += 1

        # Preserve labels as observations (0/1)
        hyp = parse_bool01(row.get("hypertension"))
        if hyp is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HYPERTENSION_LABEL", "hypertension", i, value_numeric=float(hyp))
            observations += 1
            if hyp == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Hypertension", status="active")
                conditions += 1

        hd = parse_bool01(row.get("heart_disease"))
        if hd is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HEART_DISEASE_LABEL", "heart_disease", i, value_numeric=float(hd))
            observations += 1
            if hd == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Heart Disease", status="active")
                conditions += 1

        # Diabetes label: support both `is_diabetic` and `diabetes` column names.
        # Diabetes label from dataset2 (column 'diabetes' is 0/1)
        raw_diab = row.get("diabetes")
        diab = parse_bool01(raw_diab)
        if diab is not None:
            create_observation(
                graph,
                patient,
                patient_id,
                dataset_name,
                "DIABETES_LABEL",
                "diabetes",  # source column name
                i,
                value_numeric=float(diab),
            )
            observations += 1
            if diab == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Diabetes", status="active")
                conditions += 1

        # Dynamic extra columns (demographics-heavy etc.)
        for col, dyn_code in dyn_map.items():
            raw = row.get(col)
            if is_nan(raw):
                continue
            # try numeric else text
            num = parse_float(raw)
            if num is not None:
                create_observation(graph, patient, patient_id, dataset_name, dyn_code, col, i, value_numeric=num)
            else:
                txt = str(raw).strip()
                if txt:
                    create_observation(graph, patient, patient_id, dataset_name, dyn_code, col, i, value_text=txt)
            observations += 1

    return patients, observations, conditions

def process_dataset3(graph: Graph, df: pd.DataFrame, dyn_map: Dict[str, str]) -> Tuple[int, int, int]:
    """
    Dataset-3 sample columns:
    gender, age, hypertension, heart_disease, smoking_history, bmi, hba1c_level, blood_glucose_level, diabetes
    """
    dataset_name = "dataset3"
    patients = observations = conditions = 0

    for i, row in df.iterrows():
        patient_id = f"d3_{sha1_hex(f'{dataset_name}|{i}')}"
        patient = create_or_get_patient(graph, patient_id)
        patients += 1

        sex = normalize_sex(row.get("gender"))
        age = parse_float(row.get("age"))
        set_patient_demographics(graph, patient, sex, age)

        bmi = parse_float(row.get("bmi"))
        if bmi is not None:
            create_observation(graph, patient, patient_id, dataset_name, "BMI", "bmi", i, value_numeric=bmi, unit="kg/m2")
            observations += 1

        # column could be HbA1c_level or hba1c_level depending on file, after normalization it's lowercase
        hba1c = parse_float(row.get("hba1c_level"))
        if hba1c is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HBA1C", "hba1c_level", i, value_numeric=hba1c, unit="%")
            observations += 1

        glu = parse_float(row.get("blood_glucose_level"))
        if glu is not None:
            create_observation(graph, patient, patient_id, dataset_name, "RANDOM_GLUCOSE", "blood_glucose_level", i, value_numeric=glu, unit="mg/dL")
            observations += 1

        smoking = row.get("smoking_history")
        if not is_nan(smoking):
            st = str(smoking).strip()
            if st:
                create_observation(graph, patient, patient_id, dataset_name, "SMOKING_STATUS", "smoking_history", i, value_text=st)
                observations += 1

        hyp = parse_bool01(row.get("hypertension"))
        if hyp is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HYPERTENSION_LABEL", "hypertension", i, value_numeric=float(hyp))
            observations += 1
            if hyp == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Hypertension", status="active")
                conditions += 1

        hd = parse_bool01(row.get("heart_disease"))
        if hd is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HEART_DISEASE_LABEL", "heart_disease", i, value_numeric=float(hd))
            observations += 1
            if hd == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Heart Disease", status="active")
                conditions += 1

        diab = parse_bool01(row.get("is_diabetic"))
        if diab is not None:
            create_observation(graph, patient, patient_id, dataset_name, "DIABETES_LABEL", "diabetes", i, value_numeric=float(diab))
            observations += 1
            if diab == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Diabetes", status="active")
                conditions += 1

        for col, dyn_code in dyn_map.items():
            raw = row.get(col)
            if is_nan(raw):
                continue
            num = parse_float(raw)
            if num is not None:
                create_observation(graph, patient, patient_id, dataset_name, dyn_code, col, i, value_numeric=num)
            else:
                txt = str(raw).strip()
                if txt:
                    create_observation(graph, patient, patient_id, dataset_name, dyn_code, col, i, value_text=txt)
            observations += 1

    return patients, observations, conditions

def process_dataset4(graph: Graph, df: pd.DataFrame, dyn_map: Dict[str, str]) -> Tuple[int, int, int]:
    """
    Dataset-4 sample columns:
    age, gender, pulse_rate, systolic_bp, diastolic_bp, glucose, height, weight, bmi,
    family_diabetes, hypertensive, family_hypertension, cardiovascular_disease, stroke, diabetic
    """
    dataset_name = "dataset4"
    patients = observations = conditions = 0

    for i, row in df.iterrows():
        patient_id = f"d4_{sha1_hex(f'{dataset_name}|{i}')}"
        patient = create_or_get_patient(graph, patient_id)
        patients += 1

        sex = normalize_sex(row.get("gender"))
        age = parse_float(row.get("age"))

        # height in meters (e.g., 1.65) or cm; normalize to cm for Patient property
        height_raw = parse_float(row.get("height"))
        weight_kg = parse_float(row.get("weight"))

        height_m = None
        height_cm = None
        if height_raw is not None:
            if height_raw <= 3.0:
                height_m = height_raw
                height_cm = height_raw * 100.0
            else:
                # assume cm
                height_cm = height_raw
                height_m = height_raw / 100.0

        set_patient_demographics(graph, patient, sex, age, height_cm=height_cm, weight_kg=weight_kg)

        # vitals
        pulse = parse_float(row.get("pulse_rate"))
        if pulse is not None:
            create_observation(graph, patient, patient_id, dataset_name, "PULSE_RATE", "pulse_rate", i, value_numeric=pulse, unit="bpm")
            observations += 1

        sbp = parse_float(row.get("systolic_bp"))
        if sbp is not None:
            create_observation(graph, patient, patient_id, dataset_name, "BLOOD_PRESSURE_SYSTOLIC", "systolic_bp", i, value_numeric=sbp, unit="mmHg")
            observations += 1

        dbp = parse_float(row.get("diastolic_bp"))
        if dbp is not None:
            create_observation(graph, patient, patient_id, dataset_name, "BLOOD_PRESSURE_DIASTOLIC", "diastolic_bp", i, value_numeric=dbp, unit="mmHg")
            observations += 1

        # glucose: mmol/L -> mg/dL
        glu_mmol = parse_float(row.get("glucose"))
        if glu_mmol is not None:
            glu_mgdl = glu_mmol * 18.0
            create_observation(graph, patient, patient_id, dataset_name, "RANDOM_GLUCOSE", "glucose", i, value_numeric=glu_mgdl, unit="mg/dL")
            observations += 1

        if height_m is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HEIGHT_M", "height", i, value_numeric=height_m, unit="m")
            observations += 1

        if weight_kg is not None:
            create_observation(graph, patient, patient_id, dataset_name, "WEIGHT_KG", "weight", i, value_numeric=weight_kg, unit="kg")
            observations += 1

        bmi = parse_float(row.get("bmi"))
        if bmi is not None:
            create_observation(graph, patient, patient_id, dataset_name, "BMI", "bmi", i, value_numeric=bmi, unit="kg/m2")
            observations += 1

        fam_d = parse_bool01(row.get("family_diabetes"))
        if fam_d is not None:
            create_observation(graph, patient, patient_id, dataset_name, "FAMILY_DIABETES", "family_diabetes", i, value_numeric=float(fam_d))
            observations += 1

        fam_h = parse_bool01(row.get("family_hypertension"))
        if fam_h is not None:
            create_observation(graph, patient, patient_id, dataset_name, "FAMILY_HYPERTENSION", "family_hypertension", i, value_numeric=float(fam_h))
            observations += 1

        # preserve labels as obs + create conditions only if positive
        hyp = parse_bool01(row.get("hypertensive"))
        if hyp is not None:
            create_observation(graph, patient, patient_id, dataset_name, "HYPERTENSION_LABEL", "hypertensive", i, value_numeric=float(hyp))
            observations += 1
            if hyp == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Hypertension", status="active")
                conditions += 1

        cvd = parse_bool01(row.get("cardiovascular_disease"))
        if cvd is not None:
            create_observation(graph, patient, patient_id, dataset_name, "CARDIOVASCULAR_DISEASE_LABEL", "cardiovascular_disease", i, value_numeric=float(cvd))
            observations += 1
            if cvd == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Cardiovascular Disease", status="active")
                conditions += 1

        stroke = parse_bool01(row.get("stroke"))
        if stroke is not None:
            create_observation(graph, patient, patient_id, dataset_name, "STROKE_LABEL", "stroke", i, value_numeric=float(stroke))
            observations += 1
            if stroke == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Stroke", status="active")
                conditions += 1

        diab = parse_bool01(row.get("diabetic"))
        if diab is not None:
            create_observation(graph, patient, patient_id, dataset_name, "DIABETES_LABEL", "diabetic", i, value_numeric=float(diab))
            observations += 1
            if diab == 1:
                create_condition(graph, patient, patient_id, dataset_name, "Diabetes", status="active")
                conditions += 1

        # dynamic extra columns
        for col, dyn_code in dyn_map.items():
            raw = row.get(col)
            if is_nan(raw):
                continue
            num = parse_float(raw)
            if num is not None:
                create_observation(graph, patient, patient_id, dataset_name, dyn_code, col, i, value_numeric=num)
            else:
                txt = str(raw).strip()
                if txt:
                    create_observation(graph, patient, patient_id, dataset_name, dyn_code, col, i, value_text=txt)
            observations += 1

    return patients, observations, conditions

# -----------------------------
# Main
# -----------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data_dir", required=True, help="Folder containing the 4 datasets and ontology.owl")
    ap.add_argument("--ontology", default="ontology.owl", help="Ontology OWL filename inside data_dir")
    ap.add_argument("--d1", default="Dataset of Diabetes .csv", help="Dataset-1 filename")
    ap.add_argument("--d2", default="diabetes_prediction_dataset.csv", help="Dataset-2 filename")
    ap.add_argument("--d3", default="diabetes_clean.csv", help="Dataset-3 filename")
    ap.add_argument("--d4", default="DiaBD_A Diabetes Dataset for Enhanced Risk Analysis and Research in Bangladesh.csv", help="Dataset-4 filename")
    ap.add_argument("--out", default=os.path.join("output", "healthsage_abox.ttl"), help="Output TTL path (relative or absolute)")
    args = ap.parse_args()

    data_dir = os.path.abspath(args.data_dir)
    ontology_path = os.path.join(data_dir, args.ontology)

    d1_path = os.path.join(data_dir, args.d1)
    d2_path = os.path.join(data_dir, args.d2)
    d3_path = os.path.join(data_dir, args.d3)
    d4_path = os.path.join(data_dir, args.d4)

    # load ontology
    g = load_ontology_graph(ontology_path)
    g.bind("hs", HS)

    # ensure known obsdefs exist (including label obsdefs)
    ensure_known_obsdefs(g)

    # load datasets
    df1 = load_csv(d1_path)
    df2 = load_csv(d2_path)
    df3 = load_csv(d3_path)
    df4 = load_csv(d4_path)

    # dynamic obsdefs for demographics-heavy datasets (2/3/4)
    dyn2 = build_dynamic_obsdefs_for_df(g, "dataset2", df2)
    dyn3 = build_dynamic_obsdefs_for_df(g, "dataset3", df3)
    dyn4 = build_dynamic_obsdefs_for_df(g, "dataset4", df4)

    # process
    p1, o1, c1 = process_dataset1(g, df1)
    p2, o2, c2 = process_dataset2(g, df2, dyn2)
    p3, o3, c3 = process_dataset3(g, df3, dyn3)
    p4, o4, c4 = process_dataset4(g, df4, dyn4)

    # serialize
    out_path = args.out
    if not os.path.isabs(out_path):
        out_path = os.path.join(os.getcwd(), out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    g.serialize(destination=out_path, format="turtle")

    # summary
    print("HealthSage ontology population complete.")
    print(f"Ontology path: {ontology_path}")
    print(f"Output TTL: {out_path}")
    print(f"Total triples: {len(g)}")
    print(f"dataset1: patients={p1}, observations={o1}, conditions={c1}")
    print(f"dataset2: patients={p2}, observations={o2}, conditions={c2}")
    print(f"dataset3: patients={p3}, observations={o3}, conditions={c3}")
    print(f"dataset4: patients={p4}, observations={o4}, conditions={c4}")

if __name__ == "__main__":
    main()