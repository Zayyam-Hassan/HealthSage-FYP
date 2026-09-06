"""
Guard rails for cohort construction.

These tests exist because the original pipeline's results were invalidated by
defects that no test would have caught. Each test here corresponds to a specific
failure that actually happened:

    test_no_cross_cohort_duplicate_rows   <- `diabetes_clean.csv` was a renamed
                                             copy of the Kaggle file; loading
                                             both put each patient's twin on
                                             either side of the train/test split
    test_clean_csv_is_not_ingested        <- regression guard for the same
    test_no_true_duplicate_rows_within_    <- 3,854 dup rows in Kaggle, 174 in
      cohort                                 `Dataset of Diabetes .csv`
    test_missingness_is_preserved         <- the old build imputed before
                                             counting, so it always reported
                                             "0.0% missing" for every feature
    test_label_encoding_is_unambiguous    <- the old KG encoded the label three
                                             different ways

If any of these fail, STOP. Do not report metrics from that build.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from knowledge_graph.cohorts import (
    FEATURE_CONTRACT,
    FEATURE_NAMES,
    SHARED_FEATURES,
    build_cohorts,
    feature_signature,
)

REPO = Path(__file__).resolve().parent.parent
COHORT_DIR = REPO / "data" / "cohorts"
RAW_DIR = REPO / "data" / "raw"

COHORTS = ("primary_kaggle", "external_bd", "external_iq")


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="module")
def manifest() -> dict:
    path = COHORT_DIR / "manifest.json"
    if not path.exists():
        pytest.skip("cohorts not built; run `python -m knowledge_graph.cohorts`")
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def frames() -> dict[str, pd.DataFrame]:
    out = {}
    for name in COHORTS:
        p = COHORT_DIR / f"{name}.parquet"
        if not p.exists():
            pytest.skip(f"{name}.parquet missing; run `python -m knowledge_graph.cohorts`")
        out[name] = pd.read_parquet(p)
    return out


# --------------------------------------------------------------------------
# THE critical test: the defect that invalidated the original results
# --------------------------------------------------------------------------
def test_no_cross_cohort_duplicate_rows(frames):
    """
    No two cohorts may share an identical clinical-feature row.

    This is the exact failure that invalidated the original evaluation. If it
    ever returns, every downstream metric is contaminated.
    """
    sigs = {name: set(feature_signature(df)) for name, df in frames.items()}
    names = list(sigs)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            overlap = sigs[a] & sigs[b]
            assert not overlap, (
                f"{len(overlap)} identical feature rows shared between '{a}' and '{b}'. "
                f"A patient appearing in two cohorts breaks external validation. "
                f"Example: {next(iter(overlap))[:120]}"
            )


def test_clean_csv_is_not_ingested(manifest):
    """`diabetes_clean.csv` must stay excluded, with the reason recorded."""
    excluded = manifest["excluded_sources"]
    assert "diabetes_clean.csv" in excluded
    assert "duplicate" in excluded["diabetes_clean.csv"].lower()

    used = {c["source_file"] for c in manifest["cohorts"].values()}
    assert "diabetes_clean.csv" not in used, (
        "diabetes_clean.csv has been re-introduced as a source. It is a renamed "
        "copy of diabetes_prediction_dataset.csv."
    )


def test_no_true_duplicate_rows_within_cohort(frames):
    """
    No two rows may share identical features AND an identical label - those are
    information-free copies and must have been dropped.

    Rows with identical features but CONFLICTING labels are a different matter:
    they are genuine label noise and are deliberately retained. See
    `test_label_conflicts_share_a_group`.
    """
    for name, df in frames.items():
        key = feature_signature(df) + "||" + df["label"].map(
            lambda v: "" if pd.isna(v) else f"{float(v):.0f}")
        dupes = int(key.duplicated().sum())
        assert dupes == 0, f"{name}: {dupes} true duplicate rows survived de-duplication"


def test_label_conflicts_share_a_group(frames):
    """
    Feature-identical rows must share a `group_id`, whatever their labels.

    This is what allows group-aware splitting to keep clinically
    indistinguishable patients on the same side of the train/test boundary. In
    the primary cohort ~182 rows (0.19%) are feature-identical pairs with
    contradictory labels; without grouping, one would train and its twin would
    be evaluated.
    """
    for name, df in frames.items():
        sig = feature_signature(df)
        groups_per_sig = df.assign(_s=sig).groupby("_s")["group_id"].nunique()
        bad = groups_per_sig[groups_per_sig > 1]
        assert bad.empty, (
            f"{name}: {len(bad)} identical feature vectors were assigned to more "
            f"than one group_id; group-aware splitting would not protect them"
        )


def test_group_ids_present_and_consistent(frames, manifest):
    for name, df in frames.items():
        assert df["group_id"].notna().all(), f"{name}: missing group_id"
        assert manifest["cohorts"][name]["n_groups"] == int(df["group_id"].nunique())
        assert df["group_id"].nunique() <= len(df)


# --------------------------------------------------------------------------
# Integrity of the emitted cohorts
# --------------------------------------------------------------------------
def test_patient_ids_unique_and_prefixed(frames):
    prefixes = {"primary_kaggle": "kaggle_", "external_bd": "bd_", "external_iq": "iq_"}
    for name, df in frames.items():
        assert df["patient_id"].is_unique, f"{name}: duplicate patient_id values"
        assert df["patient_id"].str.startswith(prefixes[name]).all(), (
            f"{name}: patient_id must carry the cohort prefix so provenance "
            f"survives joins and splits"
        )


def test_label_encoding_is_unambiguous(frames):
    """
    Labels must be exactly {0.0, 1.0} or missing - never a string, never a third
    class. The original knowledge graph carried the label in three different
    encodings simultaneously.
    """
    for name, df in frames.items():
        vals = set(df["label"].dropna().unique())
        assert vals <= {0.0, 1.0}, f"{name}: unexpected label values {vals}"
        assert df["label"].notna().any(), f"{name}: no labels at all"


def test_prediabetic_excluded_from_labels(frames):
    """
    In `external_iq`, CLASS='P' (prediabetic) must be NaN in `label`, not folded
    into the positive class. The original pipeline silently made P positive.
    """
    df = frames["external_iq"]
    p_rows = df[df["label_raw"].astype(str).str.strip().str.upper() == "P"]
    assert len(p_rows) > 0, "expected some prediabetic rows in external_iq"
    assert p_rows["label"].isna().all(), (
        "prediabetic rows must have a missing label, not be folded into positives"
    )


def test_missingness_is_preserved(frames):
    """
    Structural missingness must survive into the parquet - i.e. NO imputation
    happened at cohort level. The original build imputed and then counted, so it
    reported 0.0% missing for every feature including ones that were entirely absent.
    """
    # Bangladesh measures no HbA1c
    assert frames["external_bd"]["hba1c"].isna().all(), (
        "external_bd.hba1c should be entirely missing - if it is populated, "
        "something imputed it"
    )
    # Dataset of Diabetes reports no glucose
    assert frames["external_iq"]["glucose"].isna().all(), (
        "external_iq.glucose should be entirely missing"
    )
    # ...and the primary cohort has no lipid panel
    assert frames["primary_kaggle"]["cholesterol"].isna().all()


def test_feature_contract_matches_reality(frames, manifest):
    """Declared per-cohort availability must match what is actually populated."""
    src_of = {"primary_kaggle": "kaggle", "external_bd": "bangladesh", "external_iq": "iraq"}
    for feat in FEATURE_CONTRACT:
        for cohort, src in src_of.items():
            populated = frames[cohort][feat.name].notna().any()
            declared = src in feat.cohorts
            assert populated == declared, (
                f"{feat.name} in {cohort}: declared={declared} but populated={populated}. "
                f"Update FEATURE_CONTRACT or fix the loader."
            )


def test_shared_features_are_actually_shared(frames):
    """Every feature in SHARED_FEATURES must be populated in all three cohorts."""
    for feat in SHARED_FEATURES:
        for name, df in frames.items():
            assert df[feat].notna().any(), f"{feat} declared shared but empty in {name}"


def test_manifest_matches_frames(frames, manifest):
    """The manifest is the thing a reviewer reads; it must not drift."""
    for name, df in frames.items():
        n = manifest["cohorts"][name]
        assert n["n_rows"] == len(df)
        assert n["n_labelled"] == int(df["label"].notna().sum())
        if n["positive_rate"] is not None:
            assert abs(n["positive_rate"] - float(df["label"].dropna().mean())) < 1e-9


def test_schema_is_identical_across_cohorts(frames):
    """All cohorts share one column set, so they can be evaluated interchangeably."""
    schemas = {name: tuple(df.columns) for name, df in frames.items()}
    first = next(iter(schemas.values()))
    for name, cols in schemas.items():
        assert cols == first, f"{name} has a divergent schema"
    for feat in FEATURE_NAMES:
        assert feat in first


# --------------------------------------------------------------------------
# Reproducibility
# --------------------------------------------------------------------------
def test_build_is_deterministic(tmp_path):
    """
    Rebuilding from the same inputs must produce byte-identical cohorts.
    Without this, "reproducible" is an aspiration rather than a property.
    """
    if not (RAW_DIR / "kaggle_diabetes_prediction.csv").exists():
        pytest.skip("raw CSVs not present")

    a, b = tmp_path / "a", tmp_path / "b"
    build_cohorts(RAW_DIR, a)
    build_cohorts(RAW_DIR, b)

    for name in COHORTS:
        fa = pd.read_parquet(a / f"{name}.parquet")
        fb = pd.read_parquet(b / f"{name}.parquet")
        pd.testing.assert_frame_equal(fa, fb, check_exact=True)
