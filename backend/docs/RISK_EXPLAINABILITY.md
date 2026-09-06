# Risk prediction explainability

## How it works

Risk **prediction** (score and label) comes from **GraphSAGE** via `services/risk/prediction_service.py` → `services/prediction/service.py` (model inference).

Risk **explainability** (why this score, which factors matter) comes from **`services/risk/graph_explainer.py`**. It uses the **PyTorch Geometric GNNExplainer** when available, and falls back to a heuristic feature-importance method otherwise.

### Primary method: GNNExplainer (PyTorch Geometric)

- **Entry:** `get_risk_with_explanation(patient_id)` runs prediction, then `explain_risk_prediction(patient_id, prediction)`.
- **GNNExplainer path** (`_explain_with_gnn_explainer`):
  - Loads the **same GraphSAGE model** and **patient feature vector** used for prediction (from Mongo + artifacts).
  - Builds a single-node graph `(x, edge_index)` with the patient’s normalized features (same as inference; edges are empty for single-patient inference).
  - Uses **PyG’s `Explainer`** with **`GNNExplainer`** algorithm:
    - **Explanation type:** `"model"` (explain the model’s prediction).
    - **Node mask type:** `"common_attributes"` so the explainer learns a **per-feature importance** (mask over input dimensions).
    - **Model config:** binary classification, node-level, raw logits.
  - Optimizes the feature mask for a configurable number of epochs (default 50) so that the masked input preserves the model’s prediction; the learned mask values are used as **feature importance**.
  - Maps importance back to **feature names** (e.g. HBA1C, BMI) from `feature_meta` and returns:
    - `risk_explanation`: short text by risk band.
    - `top_features`: list of `{name, importance}` (from GNNExplainer).
    - `graph_context_summary`: note that the explanation is from GNNExplainer.
    - `method`: `"gnn_explainer"`.

So when GNNExplainer runs successfully, **explainability is learned from the GraphSAGE model** (which input features the model relied on for this outcome), not from fixed rules.

### Fallback: heuristic feature importance

If GNNExplainer fails (e.g. import error, runtime error, or unsupported graph setup), the explainer falls back to a **rule-based** method:

- Uses the **patient feature vector** and **fixed heuristic weights** per feature (e.g. HBA1C 0.28, glucose 0.18, BMI 0.15, …).
- **Contribution** per feature = `|normalized_value| × weight`; rank and return top 8.
- Returns the same structure with `method`: `"feature_importance"` and a `graph_context_summary` noting the heuristic fallback.

### Where it’s used

- **Risk routes:** `GET /risk/{patient_id}/explain` returns risk + this explanation.
- **Coordinator / Explain mode:** Uses `get_risk_with_explanation` and passes the explanation into the explainability agent.
- **Master agent:** Tools `get_risk_explain` and `get_explainability` use this same risk + explanation pipeline.

### Tuning GNNExplainer

In `services/risk/graph_explainer.py`:

- **`GNN_EXPLAINER_EPOCHS`** (default 50): more epochs can improve explanation quality at the cost of latency.
- **`GNN_EXPLAINER_LR`** (default 0.01): learning rate for the mask optimization.
