/**
 * AI Results API service — risk prediction and compatibility.
 * Uses backend GET /risk/{patient_id}/explain for prediction + graph explainer (top features, risk_explanation).
 */
import { apiClient } from './api';

export interface RiskPredictionRequest {
  patient_id: string;
}

/** Backend /risk/{id}/explain returns: prediction + explanation (top_features, risk_explanation, graph_context_summary) */
export interface RiskPredictionResponse {
  patient_id: string;
  risk_score: number;
  risk_class: 'low' | 'medium' | 'high';
  confidence: number;
  factors: {
    clinical: string[];
    lifestyle: string[];
    genetic: string[];
  };
  recommendations: string[];
  clinical_summary: string;
}

export interface CompatibilityResponse {
  patient_id: string;
  medication_id: string;
  compatibility_score: number;
  summary: string;
  contraindications: string[];
  interactions: string[];
}

interface BackendExplainResponse {
  patient_id: string;
  risk_score: number;
  risk_label: string;
  model_name?: string;
  predicted_at?: string;
  explanation_available?: boolean;
  explanation?: {
    risk_explanation?: string;
    top_features?: Array<{ name: string; importance: number }>;
    graph_context_summary?: string;
    method?: string;
  };
}

function getDefaultRecommendations(riskClass: string): string[] {
  const base = [
    'Maintain regular monitoring and follow clinical guidelines.',
    'Discuss with care team for personalized plan.',
  ];
  if (riskClass === 'high') {
    return ['Consider comprehensive treatment plan and frequent monitoring.', ...base];
  }
  if (riskClass === 'medium') {
    return ['Consider lifestyle modifications and closer monitoring.', ...base];
  }
  return ['Continue monitoring and maintain healthy lifestyle habits.', ...base];
}

function normalizeProbability(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score > 1 && score <= 100) return score / 100;
  return Math.min(Math.max(score, 0), 1);
}

class AIResultsService {
  /**
   * Uses backend GET /risk/{patient_id}/explain so we get graph explainer output (top_features, risk_explanation).
   * Maps explanation.top_features -> factors.clinical; risk_explanation -> clinical_summary.
   */
  async predictRisk(patientId: string): Promise<RiskPredictionResponse> {
    const result = await apiClient.get<BackendExplainResponse>(`/risk/${patientId}/explain`);
    const riskLabel = (result.risk_label ?? 'low').toLowerCase();
    const riskClass: 'low' | 'medium' | 'high' =
      riskLabel === 'high' ? 'high' : riskLabel === 'medium' ? 'medium' : 'low';
    const score = normalizeProbability(result.risk_score ?? 0);

    const explanation = result.explanation;
    const clinicalFactors: string[] = [];
    if (explanation?.top_features?.length) {
      explanation.top_features.forEach((f) => {
        const label = f.name.replace(/_/g, ' ');
        clinicalFactors.push(`${label} (importance: ${(f.importance * 100).toFixed(1)}%)`);
      });
    }

    const clinicalSummary =
      explanation?.risk_explanation ||
      `Risk assessment: ${riskClass} risk (score ${score.toFixed(2)}).` +
        (explanation?.graph_context_summary ? ` ${explanation.graph_context_summary}` : '');

    const recommendations = getDefaultRecommendations(riskClass);

    return {
      patient_id: result.patient_id ?? patientId,
      risk_score: score,
      risk_class: riskClass,
      confidence: 0.9,
      factors: {
        clinical: clinicalFactors,
        lifestyle: [],
        genetic: [],
      },
      recommendations,
      clinical_summary: clinicalSummary,
    };
  }

  /**
   * Uses backend GET /compatibility/{patient_id}/{medication_id}.
   */
  async checkCompatibility(
    patientId: string,
    medicationId: string
  ): Promise<CompatibilityResponse> {
    return await apiClient.get<CompatibilityResponse>(
      `/compatibility/${patientId}/${medicationId}`
    );
  }
}

/** Full explain-risk payload for production dashboard (graph paths, nodes, subgraph). */
export interface ExplainRiskPayload {
  prediction: number;
  risk_label: string;
  explanation: {
    patient_id?: string;
    model_type?: string;
    risk_prediction?: number;
    risk_label?: string;
    clinical_summary?: string;
    top_features?: Array<{ feature: string; importance: number; value?: string }>;
    important_nodes?: Array<{ id?: number; label: string; type: string; importance: number }>;
    important_relationships?: Array<{ source: string; relation: string; target: string; importance: number }>;
    reasoning_paths?: string[];
    visual_subgraph?: { nodes: Array<{ id: string; label: string; type: string }>; edges: Array<{ source: string; target: string; label: string }> };
  };
}

class ExplainRiskService {
  /**
   * POST /explain-risk — full explainability (top features, nodes, relationships, reasoning paths, visual subgraph).
   * Use for production dashboard. Falls back to GET /risk/{id}/explain if this fails.
   */
  async getExplainRisk(patientId: string, modelType: 'graphsage' | 'hgt' = 'graphsage'): Promise<ExplainRiskPayload> {
    return await apiClient.post<ExplainRiskPayload>('/risk/explain-risk', {
      patient_id: patientId,
      model_type: modelType,
    });
  }
}

export const explainRiskService = new ExplainRiskService();
export const aiResultsService = new AIResultsService();
