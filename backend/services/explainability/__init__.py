"""Explainability layer: GNNRiskExplainer and formatting for risk explanation API."""

from .explanation_formatter import (
    build_clinical_summary,
    build_reasoning_paths,
    build_visual_subgraph,
    label_risk,
    normalize_top_items,
)
from .gnn_explainer import GNNRiskExplainer, run_explain_risk

__all__ = [
    "GNNRiskExplainer",
    "run_explain_risk",
    "label_risk",
    "normalize_top_items",
    "build_clinical_summary",
    "build_reasoning_paths",
    "build_visual_subgraph",
]
