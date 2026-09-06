"""
Cohort construction: raw CSVs -> harmonised, de-duplicated patient cohorts.

This is the ROOT of the pipeline. Everything downstream (graph construction,
model training, evaluation) reads the parquets this module emits. The previous
implementation built its graph directly from four CSVs, two of which were the
same dataset; this module exists so that never happens silently again.

Design rules
------------
1. NO IMPUTATION HERE. Missingness is structural (the Iraq cohort has no
   glucose; the Bangladesh cohort has no HbA1c) and is recorded in the manifest
   so downstream code can make an explicit, auditable choice. Filling a global
   mean at this stage is how the original pipeline ended up reporting "0.0%
   missing" for every feature.
2. Every unit conversion is named and logged.
3. Deterministic patient IDs, prefixed by cohort, so provenance survives every
   join and split.
4. Duplicates are detected and reported, not quietly dropped.

Cohort roles
------------
    primary_kaggle  training + internal val/test  (96,146, 8.8% positive)
    external_bd     held out, never trained on    ( 5,287, 6.5% positive)
    external_iq     held out, never trained on    (   826, 87.8% positive)

`diabetes_clean.csv` is deliberately NOT loaded: it is a renamed copy of
`diabetes_prediction_dataset.csv` (identical BMI/glucose/HbA1c distributions to
6 dp, identical 8.5% positive rate). Ingesting both placed each patient's twin
on either side of the train/test split and invalidated every reported metric.

`Dataset of Diabetes .csv` (external_iq) is RETAINED despite its small size and
skewed prevalence, because it is the only source of the lipid panel (Chol, HDL,
LDL, TG) and kidney markers (Urea, Cr) that the deployed application's lab-entry
form collects from clinicians. Dropping it would permanently concede that six
fields in the clinical UI are decorative. It is external-validation only; it is
never trained on.

The prevalence shift across cohorts (8.8% -> 6.5% -> 87.8%) is deliberate: it
makes external validation a genuine generalisation and calibration test rather
than a formality.

Usage
-----
    python -m knowledge_graph.cohorts
    python -m knowledge_graph.cohorts --raw-dir data/raw --out-dir data/cohorts
"""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

log = logging.getLogger("cohorts")

# --------------------------------------------------------------------------
# Unit conversions - each is named so it shows up in the log and the manifest
# --------------------------------------------------------------------------
MMOL_L_TO_MG_DL_GLUCOSE = 18.0182  # standard factor for glucose


# --------------------------------------------------------------------------
# The feature contract
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Feature:
    """One canonical column: its unit, dtype, and which cohorts supply it."""

    name: str
    unit: str
    kind: str  # "numeric" | "binary" | "categorical"
    cohorts: tuple[str, ...]  # cohorts expected to populate it
    description: str = ""


#: Canonical schema. `cohorts` declares EXPECTED availability; the manifest
#: records ACTUAL availability, and `validate_contract` fails on a mismatch.
FEATURE_CONTRACT: tuple[Feature, ...] = (
    # --- shared by all three cohorts: the only features usable for external validation
    Feature("age", "years", "numeric", ("kaggle", "bangladesh", "iraq")),
    Feature("sex", "1=male,0=female", "binary", ("kaggle", "bangladesh", "iraq")),
    Feature("bmi", "kg/m2", "numeric", ("kaggle", "bangladesh", "iraq")),
    # --- present in two of three
    Feature("hba1c", "%", "numeric", ("kaggle", "iraq"),
            "Bangladesh cohort does not measure HbA1c"),
    Feature("glucose", "mg/dL", "numeric", ("kaggle", "bangladesh"),
            "Iraq cohort does not report glucose; Bangladesh converted from mmol/L"),
    # --- Kaggle + Bangladesh comorbidities
    Feature("hypertension", "0/1", "binary", ("kaggle", "bangladesh")),
    Feature("heart_disease", "0/1", "binary", ("kaggle", "bangladesh"),
            "Bangladesh 'cardiovascular_disease' mapped here; not strictly identical"),
    # --- single-cohort features
    Feature("smoking", "category", "categorical", ("kaggle",)),
    Feature("systolic_bp", "mmHg", "numeric", ("bangladesh",)),
    Feature("diastolic_bp", "mmHg", "numeric", ("bangladesh",)),
    Feature("family_diabetes", "0/1", "binary", ("bangladesh",)),
    Feature("cholesterol", "mmol/L", "numeric", ("iraq",)),
    Feature("hdl", "mmol/L", "numeric", ("iraq",)),
    Feature("ldl", "mmol/L", "numeric", ("iraq",)),
    Feature("triglycerides", "mmol/L", "numeric", ("iraq",)),
    Feature("urea", "mmol/L", "numeric", ("iraq",)),
    Feature("creatinine", "umol/L", "numeric", ("iraq",)),
)

FEATURE_NAMES: tuple[str, ...] = tuple(f.name for f in FEATURE_CONTRACT)

#: Features every cohort has - the only ones an externally-validated model may use.
SHARED_FEATURES: tuple[str, ...] = tuple(
    f.name for f in FEATURE_CONTRACT
    if {"kaggle", "bangladesh", "iraq"}.issubset(set(f.cohorts))
)

#: Bookkeeping columns carried alongside the features.
#:
#: `group_id` is a stable hash of the clinical-feature vector. Rows sharing a
#: group_id are clinically indistinguishable and MUST be kept together when
#: splitting - otherwise a test patient's twin sits in the training set and the
#: evaluation is not independent. Downstream splitting is group-aware for this
#: reason (see evaluation/splits.py).
META_COLUMNS: tuple[str, ...] = ("patient_id", "source", "group_id", "label", "label_raw")


# --------------------------------------------------------------------------
# Parsing helpers
# --------------------------------------------------------------------------
def _to_float(s: pd.Series) -> pd.Series:
    """Numeric coercion that tolerates stray whitespace and blanks."""
    return pd.to_numeric(s.astype(str).str.strip().replace({"": None}), errors="coerce")


def _sex_to_binary(s: pd.Series) -> pd.Series:
    """Male -> 1.0, Female -> 0.0, anything else -> NaN (e.g. Kaggle's 'Other')."""
    t = s.astype(str).str.strip().str.lower()
    return pd.Series(
        np.where(t.isin(["m", "male"]), 1.0, np.where(t.isin(["f", "female"]), 0.0, np.nan)),
        index=s.index,
        dtype="float64",
    )


def _yes_no_to_binary(s: pd.Series) -> pd.Series:
    """'Yes'/'No'/1/0/'true'/'false' -> 1.0/0.0, else NaN."""
    t = s.astype(str).str.strip().str.lower()
    return pd.Series(
        np.where(t.isin(["1", "yes", "y", "true", "t"]), 1.0,
                 np.where(t.isin(["0", "no", "n", "false", "f"]), 0.0, np.nan)),
        index=s.index,
        dtype="float64",
    )


def feature_signature(df: pd.DataFrame, columns: tuple[str, ...] = FEATURE_NAMES) -> pd.Series:
    """
    Stable per-row signature over the feature space.

    Used for duplicate detection within and across cohorts. Numeric columns are
    rounded to 6 dp and formatted with a fixed width so that 27.32 and 27.320000
    collide as they should; NaN maps to the empty string. Mixing dtypes and
    calling DataFrame.astype(str) does NOT work reliably here, hence the
    explicit per-column handling.
    """
    parts: list[list[str]] = []
    for col in columns:
        s = df[col]
        if pd.api.types.is_numeric_dtype(s):
            parts.append([("" if pd.isna(v) else f"{float(v):.6f}") for v in s])
        else:
            parts.append([("" if pd.isna(v) else str(v).strip()) for v in s])
    return pd.Series(["|".join(vals) for vals in zip(*parts)], index=df.index)


# --------------------------------------------------------------------------
# Result container
# --------------------------------------------------------------------------
@dataclass
class CohortResult:
    name: str
    frame: pd.DataFrame
    notes: dict[str, Any] = field(default_factory=dict)


def _finalise(name: str, df: pd.DataFrame, notes: dict[str, Any]) -> CohortResult:
    """
    Add missing contract columns as NaN, drop true duplicates, assign group ids.

    Two distinct situations are handled differently:

    * **True duplicates** - identical features AND identical label. These carry
      no information and are dropped.
    * **Label conflicts** - identical features, DIFFERENT label. These are real
      label noise (the same clinical presentation with different outcomes) and
      are KEPT, because deleting them would silently discard contradictory
      evidence and flatter the model. They are instead assigned a shared
      `group_id` so that group-aware splitting keeps them on the same side of
      the train/test boundary.
    """
    for col in FEATURE_NAMES:
        if col not in df.columns:
            df[col] = np.nan

    df = df.reset_index(drop=True)

    # --- drop TRUE duplicates: same features AND same label
    sig = feature_signature(df)
    sig_and_label = sig + "||" + df["label"].map(
        lambda v: "" if pd.isna(v) else f"{float(v):.0f}")
    dup_mask = sig_and_label.duplicated(keep="first")
    notes["duplicate_feature_rows_dropped"] = int(dup_mask.sum())
    if dup_mask.any():
        log.warning("[%s] dropping %d true duplicate rows (same features, same label)",
                    name, int(dup_mask.sum()))
        df = df.loc[~dup_mask].reset_index(drop=True)

    # --- assign group ids over the surviving rows
    sig = feature_signature(df)
    codes, _ = pd.factorize(sig)
    df["group_id"] = [f"{name}_g{c:06d}" for c in codes]

    # --- report remaining label conflicts (kept, not dropped)
    per_group = df.groupby("group_id")["label"].nunique(dropna=True)
    conflict_groups = per_group[per_group > 1].index
    n_conflict_rows = int(df["group_id"].isin(conflict_groups).sum())
    notes["label_conflict_groups"] = int(len(conflict_groups))
    notes["label_conflict_rows"] = n_conflict_rows
    if n_conflict_rows:
        log.warning(
            "[%s] %d rows in %d groups are feature-identical with CONFLICTING labels; "
            "kept as label noise, group-aware splitting will keep them together",
            name, n_conflict_rows, len(conflict_groups))

    df = df[list(META_COLUMNS) + list(FEATURE_NAMES)].reset_index(drop=True)

    notes["n_rows"] = int(len(df))
    notes["n_groups"] = int(df["group_id"].nunique())
    lab = df["label"].dropna()
    notes["n_labelled"] = int(len(lab))
    notes["positive_rate"] = float(lab.mean()) if len(lab) else None
    return CohortResult(name=name, frame=df, notes=notes)


# --------------------------------------------------------------------------
# Per-cohort loaders
# --------------------------------------------------------------------------
def load_kaggle(path: Path) -> CohortResult:
    """
    Kaggle 'Diabetes prediction dataset' -> PRIMARY cohort.

    Columns: gender, age, hypertension, heart_disease, smoking_history, bmi,
             HbA1c_level, blood_glucose_level, diabetes

    NOTE: `diabetes_clean.csv` in the original repo is this same dataset with
    renamed columns. It is deliberately not loaded. Ingesting both put each
    patient's twin on either side of the train/test split.
    """
    raw = pd.read_csv(path)
    notes: dict[str, Any] = {
        "source_file": path.name,
        "raw_rows": int(len(raw)),
        "role": "primary",
        "exact_duplicate_rows_in_source": int(raw.duplicated().sum()),
        "conversions": [],
    }
    log.info("[kaggle] %d raw rows, %d exact duplicates in source",
             len(raw), notes["exact_duplicate_rows_in_source"])

    df = pd.DataFrame({
        "source": "kaggle",
        "age": _to_float(raw["age"]),
        "sex": _sex_to_binary(raw["gender"]),
        "bmi": _to_float(raw["bmi"]),
        "hba1c": _to_float(raw["HbA1c_level"]),
        "glucose": _to_float(raw["blood_glucose_level"]),  # already mg/dL
        "hypertension": _yes_no_to_binary(raw["hypertension"]),
        "heart_disease": _yes_no_to_binary(raw["heart_disease"]),
        "smoking": raw["smoking_history"].astype(str).str.strip().str.lower(),
        "label_raw": raw["diabetes"].astype(str),
        "label": _yes_no_to_binary(raw["diabetes"]),
    })
    df.insert(0, "patient_id", [f"kaggle_{i:06d}" for i in range(len(df))])
    return _finalise("primary_kaggle", df, notes)


def load_bangladesh(path: Path) -> CohortResult:
    """
    DiaBD (Bangladesh) -> EXTERNAL validation cohort.

    Columns: age, gender, pulse_rate, systolic_bp, diastolic_bp, glucose,
             height, weight, bmi, family_diabetes, hypertensive,
             family_hypertension, cardiovascular_disease, stroke, diabetic

    Glucose is reported in mmol/L and converted to mg/dL to match the Kaggle
    cohort. No HbA1c is measured.
    """
    raw = pd.read_csv(path)
    notes: dict[str, Any] = {
        "source_file": path.name,
        "raw_rows": int(len(raw)),
        "role": "external",
        "exact_duplicate_rows_in_source": int(raw.duplicated().sum()),
        "conversions": [f"glucose mmol/L -> mg/dL (x{MMOL_L_TO_MG_DL_GLUCOSE})"],
        "caveats": [
            "no HbA1c measured in this cohort",
            "'cardiovascular_disease' mapped to heart_disease; not strictly identical",
        ],
    }
    log.info("[bangladesh] %d raw rows", len(raw))

    df = pd.DataFrame({
        "source": "bangladesh",
        "age": _to_float(raw["age"]),
        "sex": _sex_to_binary(raw["gender"]),
        "bmi": _to_float(raw["bmi"]),
        "glucose": _to_float(raw["glucose"]) * MMOL_L_TO_MG_DL_GLUCOSE,
        "systolic_bp": _to_float(raw["systolic_bp"]),
        "diastolic_bp": _to_float(raw["diastolic_bp"]),
        "hypertension": _yes_no_to_binary(raw["hypertensive"]),
        "heart_disease": _yes_no_to_binary(raw["cardiovascular_disease"]),
        "family_diabetes": _yes_no_to_binary(raw["family_diabetes"]),
        "label_raw": raw["diabetic"].astype(str),
        "label": _yes_no_to_binary(raw["diabetic"]),
    })
    df.insert(0, "patient_id", [f"bd_{i:06d}" for i in range(len(df))])
    return _finalise("external_bd", df, notes)


def load_iraq(path: Path) -> CohortResult:
    """
    Mendeley 'Dataset of Diabetes' (Iraq) -> EXTERNAL validation cohort.

    Columns: ID, No_Pation, Gender, AGE, Urea, Cr, HbA1c, Chol, TG, HDL, LDL,
             VLDL, BMI, CLASS

    CLASS has three levels: N (non-diabetic), P (prediabetic), Y (diabetic),
    and the raw file contains trailing-whitespace variants ('Y ', 'N ') that
    must be stripped or the label silently splits into extra categories.

    PREDIABETIC HANDLING: the original pipeline folded P into the positive
    class without saying so. Here P is retained in `label_raw` and encoded as
    NaN in `label`, so it is excluded from primary metrics by default. The
    P-as-positive sensitivity analysis is produced downstream from `label_raw`.
    """
    raw = pd.read_csv(path)
    notes: dict[str, Any] = {
        "source_file": path.name,
        "raw_rows": int(len(raw)),
        "role": "external",
        "exact_duplicate_rows_in_source": int(raw.duplicated().sum()),
        "conversions": [],
        "caveats": [
            "no glucose measured in this cohort",
            "CLASS whitespace variants stripped before encoding",
            "prediabetic (P) encoded as NaN label; excluded from primary metrics",
        ],
    }
    cls = raw["CLASS"].astype(str).str.strip().str.upper()
    notes["class_distribution"] = {k: int(v) for k, v in cls.value_counts().items()}
    log.info("[iraq] %d raw rows, CLASS distribution: %s", len(raw), notes["class_distribution"])

    df = pd.DataFrame({
        "source": "iraq",
        "age": _to_float(raw["AGE"]),
        "sex": _sex_to_binary(raw["Gender"]),
        "bmi": _to_float(raw["BMI"]),
        "hba1c": _to_float(raw["HbA1c"]),
        "cholesterol": _to_float(raw["Chol"]),
        "hdl": _to_float(raw["HDL"]),
        "ldl": _to_float(raw["LDL"]),
        "triglycerides": _to_float(raw["TG"]),
        "urea": _to_float(raw["Urea"]),
        "creatinine": _to_float(raw["Cr"]),
        "label_raw": cls,
        # Y -> 1, N -> 0, P -> NaN (excluded from primary metrics)
        "label": pd.Series(
            np.where(cls == "Y", 1.0, np.where(cls == "N", 0.0, np.nan)),
            index=raw.index, dtype="float64",
        ),
    })
    df.insert(0, "patient_id", [f"iq_{i:06d}" for i in range(len(df))])
    return _finalise("external_iq", df, notes)


# --------------------------------------------------------------------------
# Contract validation + cross-cohort contamination check
# --------------------------------------------------------------------------
def validate_contract(results: list[CohortResult]) -> dict[str, Any]:
    """
    Assert declared feature availability matches reality, and check that no two
    cohorts share identical feature rows.

    The second check is the direct guard against the failure that invalidated
    the original results: two copies of one dataset split across train and test.
    """
    by_source = {r.frame["source"].iloc[0]: r for r in results if len(r.frame)}
    availability: dict[str, dict[str, float]] = {}
    problems: list[str] = []

    for feat in FEATURE_CONTRACT:
        availability[feat.name] = {}
        for src, res in by_source.items():
            present = float(res.frame[feat.name].notna().mean())
            availability[feat.name][src] = round(present, 4)
            expected = src in feat.cohorts
            if expected and present == 0.0:
                problems.append(f"{feat.name}: declared for '{src}' but 100% missing")
            if not expected and present > 0.0:
                problems.append(
                    f"{feat.name}: NOT declared for '{src}' but {present:.1%} populated")

    # Cross-cohort duplicate feature rows
    cross: dict[str, int] = {}
    names = list(by_source)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            fa = feature_signature(by_source[a].frame)
            fb = feature_signature(by_source[b].frame)
            overlap = len(set(fa) & set(fb))
            cross[f"{a}~{b}"] = overlap
            if overlap:
                problems.append(f"{overlap} identical feature rows shared by '{a}' and '{b}'")

    return {
        "feature_availability": availability,
        "cross_cohort_identical_rows": cross,
        "problems": problems,
    }


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------
def build_cohorts(raw_dir: Path, out_dir: Path) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)

    loaders = [
        ("primary_kaggle", load_kaggle, raw_dir / "kaggle_diabetes_prediction.csv"),
        ("external_bd", load_bangladesh, raw_dir / "bangladesh_diabd.csv"),
        ("external_iq", load_iraq, raw_dir / "iraq_mendeley.csv"),
    ]

    results: list[CohortResult] = []
    for name, fn, path in loaders:
        if not path.exists():
            raise FileNotFoundError(f"missing source CSV for '{name}': {path}")
        res = fn(path)
        res.frame.to_parquet(out_dir / f"{name}.parquet", index=False)
        log.info("[%s] wrote %d rows, positive rate %s",
                 name, res.notes["n_rows"], res.notes["positive_rate"])
        results.append(res)

    validation = validate_contract(results)

    manifest = {
        "generated_by": "knowledge_graph.cohorts",
        "shared_features": list(SHARED_FEATURES),
        "feature_contract": [
            {"name": f.name, "unit": f.unit, "kind": f.kind,
             "cohorts": list(f.cohorts), "description": f.description}
            for f in FEATURE_CONTRACT
        ],
        "cohorts": {r.name: r.notes for r in results},
        "validation": validation,
        "excluded_sources": {
            "diabetes_clean.csv": (
                "Verified duplicate of diabetes_prediction_dataset.csv "
                "(identical BMI/glucose/HbA1c distributions to 6 dp, identical "
                "8.5% positive rate). Loading both placed each patient's twin on "
                "either side of the train/test split, invalidating all reported metrics."
            )
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw-dir", type=Path, default=Path("data/raw"))
    ap.add_argument("--out-dir", type=Path, default=Path("data/cohorts"))
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")
    manifest = build_cohorts(args.raw_dir, args.out_dir)

    print("\n" + "=" * 68)
    print("COHORT SUMMARY")
    print("=" * 68)
    for name, n in manifest["cohorts"].items():
        rate = n["positive_rate"]
        print(f"  {name:16s} {n['n_rows']:>7,} rows  "
              f"{n['n_labelled']:>7,} labelled  "
              f"positive {rate:.4f}" if rate is not None else f"  {name}: no labels")
    print(f"\n  shared features (usable for external validation): {', '.join(SHARED_FEATURES)}")

    problems = manifest["validation"]["problems"]
    print("\n" + "-" * 68)
    if problems:
        print(f"CONTRACT PROBLEMS ({len(problems)}):")
        for p in problems:
            print(f"  ! {p}")
        return 1
    print("Feature contract validated. No cross-cohort duplicate rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
