"""
GNNRiskExplainer: unified explainability for GraphSAGE and HGT risk prediction.
Produces structured payload for frontend and chatbot (top features, nodes, relationships,
reasoning paths, visual subgraph, clinical summary).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

import torch

from .explanation_formatter import (
    FEATURE_LABELS,
    build_clinical_summary,
    build_reasoning_paths,
    build_visual_subgraph,
    label_risk,
    normalize_top_items,
)

logger = logging.getLogger(__name__)


class GNNRiskExplainer:
    """
    Instance-level risk explanation for a patient node.
    Supports GraphSAGE (homogeneous) and HGT (heterogeneous).
    """

    def __init__(
        self,
        model: torch.nn.Module,
        graph_data: Dict[str, Any],
        device: Union[torch.device, str],
        model_type: str,
        metadata: Optional[Any] = None,
        node_type: str = "Patient",
    ):
        self.model = model
        self.graph_data = graph_data
        self.device = torch.device(device) if isinstance(device, str) else device
        self.model_type = model_type.strip().lower()
        self.metadata = metadata
        self.node_type = node_type
        if self.model_type not in ("graphsage", "hgt"):
            raise ValueError(f"model_type must be 'graphsage' or 'hgt', got {model_type!r}")

    def explain_patient(
        self,
        patient_node_id: int = 0,
        patient_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run instance-level explanation for the patient node.
        Returns structured dict: risk_prediction, risk_label, clinical_summary,
        top_features, important_nodes, important_relationships, reasoning_paths, visual_subgraph.
        """
        if self.model_type == "graphsage":
            return self._explain_graphsage_patient(patient_node_id, patient_id)
        return self._explain_hgt_patient(patient_node_id, patient_id)

    def _explain_graphsage_patient(
        self,
        patient_node_id: int,
        patient_id: Optional[str],
    ) -> Dict[str, Any]:
        """GraphSAGE: run prediction and GNNExplainer (or fallback), then format."""
        x = self.graph_data.get("x")
        edge_index = self.graph_data.get("edge_index")
        patient_values = self.graph_data.get("patient_values") or {}
        if x is None or edge_index is None:
            return self._empty_explanation(patient_id, "Missing graph data for GraphSAGE")
        try:
            self.model.eval()
            with torch.no_grad():
                logits = self.model(x.to(self.device), edge_index.to(self.device))
            prob = torch.sigmoid(logits[patient_node_id]).item()
        except Exception as e:
            logger.warning("GraphSAGE prediction failed: %s", e)
            return self._empty_explanation(patient_id, str(e))
        risk_label = label_risk(prob)

        # Get feature importance from PyG GNNExplainer or use built-in
        raw_expl = self.graph_data.get("explanation_result")
        if raw_expl is None:
            raw_expl = self._run_graphsage_explainer(x, edge_index, patient_node_id)
        top_features = self._format_top_features(
            raw_expl.get("top_features") or [],
            patient_values,
            top_k=5,
        )
        important_nodes = self._format_important_nodes(
            raw_expl.get("top_features") or [],
            patient_node_id,
            top_k=5,
        )
        important_relationships = self._format_relationships_from_features(
            raw_expl.get("top_features") or [],
            top_k=5,
        )
        reasoning_paths = build_reasoning_paths(important_relationships, top_k=3)
        clinical_summary = build_clinical_summary(risk_label, top_features, FEATURE_LABELS)
        if not clinical_summary.strip() and raw_expl.get("risk_explanation"):
            clinical_summary = raw_expl["risk_explanation"]
        visual_subgraph = build_visual_subgraph(
            important_nodes,
            important_relationships,
            patient_id or str(patient_node_id),
            top_nodes=5,
            top_edges=5,
        )
        return {
            "patient_id": patient_id or patient_node_id,
            "model_type": "graphsage",
            "risk_prediction": round(prob, 4),
            "risk_label": risk_label,
            "clinical_summary": clinical_summary,
            "top_features": top_features,
            "important_nodes": important_nodes,
            "important_relationships": important_relationships,
            "reasoning_paths": reasoning_paths,
            "visual_subgraph": visual_subgraph,
        }

    def _run_graphsage_explainer(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        patient_node_id: int,
    ) -> Dict[str, Any]:
        """Run PyG GNNExplainer; return dict with top_features and risk_explanation."""
        try:
            from torch_geometric.explain import Explainer, Explanation
            from torch_geometric.explain.algorithm import GNNExplainer
            from torch_geometric.explain.config import ModelConfig, ModelMode, ModelReturnType, ModelTaskLevel

            x = x.clone().detach().to(self.device)
            edge_index = edge_index.to(self.device)
            algorithm = GNNExplainer(epochs=50, lr=0.01)
            model_config = ModelConfig(
                mode=ModelMode.binary_classification,
                task_level=ModelTaskLevel.node,
                return_type=ModelReturnType.raw,
            )
            explainer = Explainer(
                model=self.model,
                algorithm=algorithm,
                explanation_type="model",
                model_config=model_config,
                node_mask_type="common_attributes",
                edge_mask_type=None,
            )
            explanation = explainer(x, edge_index, index=patient_node_id)
            if isinstance(explanation, Explanation) and explanation.node_mask is not None:
                imp = explanation.node_mask.detach().squeeze().cpu()
                if imp.dim() == 0:
                    imp = imp.unsqueeze(0)
                imp = imp.numpy().tolist()
                from services.risk.graph_explainer import DEFAULT_FEATURE_NAMES, _load_feature_meta
                meta = _load_feature_meta()
                names = meta.get("clinical_feature_names") or DEFAULT_FEATURE_NAMES
                top_features = []
                for i, name in enumerate(names):
                    if i >= len(imp):
                        break
                    top_features.append({"name": name, "importance": round(float(imp[i]), 4)})
                top_features.sort(key=lambda t: abs(t["importance"]), reverse=True)
                return {
                    "top_features": top_features[:8],
                    "risk_explanation": "Explanation from GNNExplainer.",
                }
        except Exception as e:
            logger.warning("GNNExplainer run failed: %s", e)
        return {"top_features": [], "risk_explanation": ""}

    def _explain_hgt_patient(
        self,
        patient_node_id: int,
        patient_id: Optional[str],
    ) -> Dict[str, Any]:
        """HGT: run prediction; use feature attribution from graph_data or fallback."""
        x_dict = self.graph_data.get("x_dict")
        edge_index_dict = self.graph_data.get("edge_index_dict")
        patient_values = self.graph_data.get("patient_values") or {}
        if x_dict is None or edge_index_dict is None:
            return self._empty_explanation(patient_id, "Missing graph data for HGT")
        try:
            self.model.eval()
            x_dict = {k: v.to(self.device) for k, v in x_dict.items()}
            edge_index_dict = {k: v.to(self.device) for k, v in edge_index_dict.items()}
            with torch.no_grad():
                logits = self.model(x_dict, edge_index_dict)
            prob = torch.sigmoid(logits[patient_node_id]).item()
        except Exception as e:
            logger.warning("HGT prediction failed: %s", e)
            return self._empty_explanation(patient_id, str(e))
        risk_label = label_risk(prob)
        raw_expl = self.graph_data.get("explanation_result")
        if raw_expl is None:
            raw_expl = {"top_features": self._hgt_fallback_features(patient_values), "risk_explanation": ""}
        top_features = self._format_top_features(
            raw_expl.get("top_features") or [],
            patient_values,
            top_k=5,
        )
        important_nodes = self._format_important_nodes(
            raw_expl.get("top_features") or [],
            patient_node_id,
            top_k=5,
        )
        important_relationships = self._format_relationships_from_features(
            raw_expl.get("top_features") or [],
            top_k=5,
        )
        reasoning_paths = build_reasoning_paths(important_relationships, top_k=3)
        clinical_summary = build_clinical_summary(risk_label, top_features, FEATURE_LABELS)
        visual_subgraph = build_visual_subgraph(
            important_nodes,
            important_relationships,
            patient_id or str(patient_node_id),
            5,
            5,
        )
        return {
            "patient_id": patient_id or patient_node_id,
            "model_type": "hgt",
            "risk_prediction": round(prob, 4),
            "risk_label": risk_label,
            "clinical_summary": clinical_summary,
            "top_features": top_features,
            "important_nodes": important_nodes,
            "important_relationships": important_relationships,
            "reasoning_paths": reasoning_paths,
            "visual_subgraph": visual_subgraph,
        }

    def _hgt_fallback_features(self, patient_values: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Heuristic feature importance for HGT when explainer not run."""
        from services.risk.graph_explainer import DEFAULT_FEATURE_NAMES, FEATURE_WEIGHTS
        names = DEFAULT_FEATURE_NAMES
        out = []
        for i, name in enumerate(names):
            val = patient_values.get(name)
            w = FEATURE_WEIGHTS.get(name, 0.05)
            contrib = abs(float(val)) * w if val is not None else w
            out.append({"name": name, "importance": round(contrib, 4)})
        out.sort(key=lambda x: x["importance"], reverse=True)
        return out[:8]

    def _format_top_features(
        self,
        raw_top: List[Dict[str, Any]],
        patient_values: Dict[str, Any],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Format to {feature, importance, value} with human labels, top_k."""
        normalized = normalize_top_items(
            [{"name": r.get("name"), "importance": r.get("importance", 0)} for r in raw_top],
            importance_key="importance",
            top_k=top_k,
        )
        out = []
        for n in normalized:
            name = n.get("name") or ""
            out.append({
                "feature": FEATURE_LABELS.get(name, name.replace("_", " ")),
                "importance": n.get("importance", 0),
                "value": str(patient_values.get(name, "")) if patient_values else "",
            })
        return out

    def _format_important_nodes(
        self,
        top_features: List[Dict[str, Any]],
        patient_node_id: int,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Derive synthetic important nodes from top features (single-node graph has no other nodes)."""
        nodes = [
            {"id": patient_node_id, "label": "Patient", "type": "Patient", "importance": 1.0},
        ]
        for i, f in enumerate(top_features[: top_k - 1]):
            name = f.get("name") or f.get("feature") or ""
            label = FEATURE_LABELS.get(name, name.replace("_", " "))
            nodes.append({
                "id": 500 + i,
                "label": f"{label} Observation",
                "type": "Observation",
                "importance": float(f.get("importance", 0)),
            })
        return normalize_top_items(nodes, importance_key="importance", top_k=top_k)

    def _format_relationships_from_features(
        self,
        top_features: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Derive synthetic relationships from top features for single-node inference."""
        out = []
        for i, f in enumerate(top_features[:top_k]):
            name = f.get("name") or f.get("feature") or ""
            label = FEATURE_LABELS.get(name, name.replace("_", " "))
            out.append({
                "source": "Patient",
                "relation": "hasObservation",
                "target": f"{label} Observation",
                "importance": float(f.get("importance", 0)),
            })
        return normalize_top_items(out, importance_key="importance", top_k=top_k)

    def _empty_explanation(self, patient_id: Optional[str], reason: str) -> Dict[str, Any]:
        """Return minimal payload when explanation fails."""
        return {
            "patient_id": patient_id,
            "model_type": self.model_type,
            "risk_prediction": 0.0,
            "risk_label": "Low Risk",
            "clinical_summary": f"Explanation unavailable: {reason}.",
            "top_features": [],
            "important_nodes": [],
            "important_relationships": [],
            "reasoning_paths": [],
            "visual_subgraph": {"nodes": [], "edges": []},
        }


def run_explain_risk(patient_id: str, model_type: str) -> Dict[str, Any]:
    """
    Load model and graph for patient, run GNNRiskExplainer, return full payload.
    Used by POST /explain-risk. Reuses existing prediction + explanation where possible.
    """
    model_type = model_type.strip().lower()
    if model_type not in ("graphsage", "hgt"):
        raise ValueError(f"model_type must be 'graphsage' or 'hgt', got {model_type!r}")

    from services.prediction.service import (
        _feature_vector_from_patient_data,
        _get_feature_meta,
        _load_graphsage_artifacts,
        _patient_data_from_mongo,
    )
    from services.risk.graph_explainer import explain_risk_prediction
    from services.risk.prediction_service import predict_patient_risk

    patient_data = _patient_data_from_mongo(patient_id)
    if model_type == "graphsage":
        from services.prediction.service import GraphSAGENet, _load_graphsage_artifacts as load_art
        artifacts = load_art()
        meta = _get_feature_meta(artifacts)
        x = _feature_vector_from_patient_data(patient_data, meta)
        if x.dim() == 1:
            x = x.unsqueeze(0)
        edge_index = torch.empty((2, 0), dtype=torch.long)
        ckpt = artifacts["checkpoint"]
        cfg = ckpt["config"]["model"]
        model = GraphSAGENet(
            ckpt["in_channels"],
            cfg["hidden_dim"],
            cfg["num_layers"],
            cfg["dropout"],
        )
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()
        prediction = predict_patient_risk(patient_id)
        explanation_result = explain_risk_prediction(patient_id, prediction)
        patient_values = {k: v for k, v in patient_data.items() if isinstance(v, (int, float))}
        graph_data = {
            "x": x,
            "edge_index": edge_index,
            "patient_values": patient_values,
            "explanation_result": explanation_result,
        }
        explainer = GNNRiskExplainer(model, graph_data, "cpu", "graphsage")
        full = explainer.explain_patient(0, patient_id)
        full["risk_prediction"] = prediction["risk_score"]
        full["risk_label"] = label_risk(prediction["risk_score"])
        return full
    else:
        from services.prediction.service import HGTNet, _load_hgt_artifacts
        artifacts = _load_hgt_artifacts()
        meta = _get_feature_meta(artifacts)
        x = _feature_vector_from_patient_data(patient_data, meta)
        if x.dim() == 1:
            x = x.unsqueeze(0)
        ckpt = artifacts["checkpoint"]
        node_types, edge_types = ckpt["metadata"]
        cfg = ckpt["config"]["model"]
        model = HGTNet(
            ckpt["in_channels"],
            (node_types, edge_types),
            cfg["hidden_dim"],
            cfg["num_layers"],
            cfg["num_heads"],
            cfg["dropout"],
        )
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()
        fd = x.shape[1]
        x_dict = {"Patient": x}
        for t in node_types:
            if t != "Patient":
                x_dict[t] = torch.zeros((0, fd), dtype=x.dtype)
        edge_index_dict = {}
        for (s, r, d) in edge_types:
            edge_index_dict[(s, r, d)] = torch.zeros((2, 0), dtype=torch.long)
        patient_values = {k: v for k, v in patient_data.items() if isinstance(v, (int, float))}
        graph_data = {
            "x_dict": x_dict,
            "edge_index_dict": edge_index_dict,
            "patient_values": patient_values,
            "explanation_result": None,
        }
        explainer = GNNRiskExplainer(model, graph_data, "cpu", "hgt", metadata=(node_types, edge_types))
        return explainer.explain_patient(0, patient_id)
