import { apiClient } from './api';

export interface WhatIfFeatureField {
  field: string;
  label: string;
  unit?: string | null;
  min_value?: number | null;
  max_value?: number | null;
  input_type: 'number' | 'text';
  baseline_value?: string | number | null;
}

export interface WhatIfSnapshot {
  risk_score: number;
  risk_label: 'low' | 'medium' | 'high';
  features: Record<string, string | number | null>;
  top_features: Array<{
    name?: string;
    feature?: string;
    importance?: number;
    value?: string;
  }>;
}

export interface WhatIfChange {
  feature: string;
  label: string;
  baseline_value: string | number | null;
  scenario_value: string | number | null;
  unit?: string | null;
}

export interface WhatIfCompareResponse {
  patient_id: string;
  patient_name?: string;
  scenario_name?: string | null;
  baseline: WhatIfSnapshot;
  scenario: WhatIfSnapshot;
  changes: WhatIfChange[];
  risk_delta: {
    absolute: number;
    relative_percent: number;
    direction: 'decrease' | 'increase' | 'no_change';
  };
  analysis: {
    summary: string;
    drivers: string[];
    clinical_interpretation: string;
    cautions: string[];
    chatbot_summary?: string | null;
  };
  requires_clinician_review: boolean;
}

export interface WhatIfBaselineResponse {
  patient_id: string;
  patient_name?: string;
  baseline: WhatIfSnapshot;
  modifiable_fields: WhatIfFeatureField[];
  generated_at: string;
}

class WhatIfService {
  async getBaseline(patientId: string): Promise<WhatIfBaselineResponse> {
    return apiClient.get<WhatIfBaselineResponse>(`/what-if/patients/${patientId}/baseline`);
  }

  async compareRisk(
    patientId: string,
    payload: {
      scenario_name?: string;
      modifications: Record<string, unknown>;
    },
  ): Promise<WhatIfCompareResponse> {
    return apiClient.post<WhatIfCompareResponse>(
      `/what-if/patients/${patientId}/risk/compare`,
      payload,
    );
  }
}

export const whatIfService = new WhatIfService();
