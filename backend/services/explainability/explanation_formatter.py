"""
Explanation formatting helpers: normalize importance, build clinical summary,
reasoning paths, visual subgraph. Used by GNNRiskExplainer and API.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

# Human-readable feature labels for clinical UI
FEATURE_LABELS: Dict[str, str] = {
    "HBA1C": "HbA1c",
    "FASTING_GLUCOSE": "Glucose (fasting)",
    "RANDOM_GLUCOSE": "Glucose (random)",
    "BMI": "BMI",
    "SYSTOLIC_BP": "Systolic BP",
    "DIASTOLIC_BP": "Diastolic BP",
    "TOTAL_CHOLESTEROL": "Total cholesterol",
    "HDL": "HDL",
    "LDL": "LDL",
    "TRIGLYCERIDES": "Triglycerides",
    "AGE": "Age",
    "SEX": "Sex",
    "HEIGHT_CM": "Height",
    "WEIGHT_KG": "Weight",
}


def label_risk(probability: float) -> str:
    """Convert risk probability to clinical label."""
    if probability < 0.35:
        return "Low Risk"
    if probability < 0.65:
        return "Moderate Risk"
    return "High Risk"


def normalize_top_items(
    items: List[Dict[str, Any]],
    importance_key: str = "importance",
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """Sort by importance (abs), take top_k, normalize importance to 0-1 scale."""
    if not items:
        return []
    sorted_items = sorted(
        items,
        key=lambda x: abs(float(x.get(importance_key, 0))),
        reverse=True,
    )[:top_k]
    values = [abs(float(x.get(importance_key, 0))) for x in sorted_items]
    max_val = max(values) if values else 1.0
    if max_val == 0:
        max_val = 1.0
    out = []
    for i, item in enumerate(sorted_items):
        new_item = dict(item)
        raw = abs(float(item.get(importance_key, 0)))
        new_item[importance_key] = round(raw / max_val, 4)
        out.append(new_item)
    return out


def build_clinical_summary(
    risk_label: str,
    top_features: List[Dict[str, Any]],
    feature_labels: Optional[Dict[str, str]] = None,
) -> str:
    """Generate short doctor-readable explanation from top features."""
    labels = feature_labels or FEATURE_LABELS
    if not top_features:
        return (
            f"The patient is predicted to have {risk_label.lower()} based on "
            "the model's assessment of available clinical and graph-derived factors."
        )
    names = []
    for f in top_features[:5]:
        raw_name = f.get("feature") or f.get("name") or ""
        names.append(labels.get(raw_name, raw_name.replace("_", " ")))
    if not names:
        return f"The patient is predicted to have {risk_label.lower()}."
    if len(names) == 1:
        factor_text = names[0]
    elif len(names) == 2:
        factor_text = f"{names[0]} and {names[1]}"
    else:
        factor_text = ", ".join(names[:-1]) + f", and {names[-1]}"
    return (
        f"The patient is predicted to have {risk_label.lower()} primarily due to "
        f"{factor_text}. Related observations and condition-linked graph connections "
        "strongly influenced the model output."
    )


def build_reasoning_paths(
    important_relationships: List[Dict[str, Any]],
    top_k: int = 3,
) -> List[str]:
    """Build short reasoning path strings from relationships."""
    paths = []
    for r in important_relationships[:top_k]:
        src = r.get("source", "?")
        rel = r.get("relation", "?")
        tgt = r.get("target", "?")
        paths.append(f"{src} -> {rel} -> {tgt}")
    return paths


def build_visual_subgraph(
    important_nodes: List[Dict[str, Any]],
    important_relationships: List[Dict[str, Any]],
    patient_id: str,
    top_nodes: int = 5,
    top_edges: int = 5,
) -> Dict[str, Any]:
    """Build minimal subgraph for frontend mini-graph visualization."""
    nodes_seen = set()
    nodes = []
    label_to_id: Dict[str, str] = {}
    for n in important_nodes[:top_nodes]:
        nid = n.get("id")
        label = n.get("label", f"Node {nid}")
        ntype = n.get("type", "Node")
        key = (nid, label, ntype)
        if key in nodes_seen:
            continue
        nodes_seen.add(key)
        vid = f"n{nid}" if nid is not None else f"n{len(nodes)}"
        label_to_id[label] = vid
        nodes.append({"id": vid, "label": label, "type": ntype})
    p_id = f"p{patient_id}"
    if "Patient" not in label_to_id:
        nodes.insert(0, {"id": p_id, "label": "Patient", "type": "Patient"})
        label_to_id["Patient"] = p_id
    edges = []
    for r in important_relationships[:top_edges]:
        src = r.get("source", "Patient")
        tgt = r.get("target", "?")
        rel = r.get("relation", "relatedTo")
        src_id = label_to_id.get(src, p_id if src == "Patient" else f"n{src}")
        tgt_id = label_to_id.get(tgt, f"n{tgt}")
        edges.append({"source": src_id, "target": tgt_id, "label": rel})
    return {"nodes": nodes, "edges": edges}
