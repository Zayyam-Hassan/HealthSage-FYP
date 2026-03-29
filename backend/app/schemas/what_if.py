from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class WhatIfScenarioRequest(BaseModel):
    scenario_name: Optional[str] = Field(default=None, description="Optional label for the scenario")
    modifications: Dict[str, Any] = Field(default_factory=dict, description="Feature overrides for simulation")


class WhatIfFeatureChange(BaseModel):
    feature: str
    label: str
    baseline_value: Any = None
    scenario_value: Any = None
    unit: Optional[str] = None


class WhatIfFeatureField(BaseModel):
    field: str
    label: str
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    input_type: str = "number"
    baseline_value: Any = None


class WhatIfSnapshot(BaseModel):
    risk_score: float
    risk_label: str
    features: Dict[str, Any] = Field(default_factory=dict)
    top_features: List[Dict[str, Any]] = Field(default_factory=list)


class WhatIfDelta(BaseModel):
    absolute: float
    relative_percent: float
    direction: str


class WhatIfAnalysis(BaseModel):
    summary: str = ""
    drivers: List[str] = Field(default_factory=list)
    clinical_interpretation: str = ""
    cautions: List[str] = Field(default_factory=list)
    chatbot_summary: Optional[str] = None


class WhatIfBaselineResponse(BaseModel):
    patient_id: str
    baseline: WhatIfSnapshot
    modifiable_fields: List[WhatIfFeatureField] = Field(default_factory=list)
    generated_at: str


class WhatIfCompareResponse(BaseModel):
    patient_id: str
    scenario_name: Optional[str] = None
    baseline: WhatIfSnapshot
    scenario: WhatIfSnapshot
    changes: List[WhatIfFeatureChange] = Field(default_factory=list)
    risk_delta: WhatIfDelta
    analysis: WhatIfAnalysis
    requires_clinician_review: bool = True

