import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  callRiskExplain,
  callRiskPrediction,
  callExplainRisk,
} from '../integrations/fastapi/client';

// Proxy for /risk/{patient_id}/explain used by AIResultsService.predictRisk
export async function getRiskExplain(req: Request, res: Response): Promise<void> {
  const { patientId } = req.params;
  try {
    const [prediction, explanation] = await Promise.all([
      callRiskPrediction(patientId),
      callRiskExplain(patientId).catch(() => null),
    ]);

    res.json({
      patient_id: prediction?.patient_id ?? explanation?.patient_id ?? patientId,
      risk_score: prediction?.risk_score ?? explanation?.risk_score ?? 0,
      risk_label: prediction?.risk_label ?? explanation?.risk_label ?? 'low',
      predicted_label:
        prediction?.predicted_label ??
        explanation?.predicted_label ??
        0,
      model_name: prediction?.model_name ?? explanation?.model_name ?? 'GraphSAGE',
      predicted_at: prediction?.predicted_at ?? explanation?.predicted_at,
      explanation_available:
        explanation?.explanation_available ?? prediction?.explanation_available ?? false,
      explanation: explanation?.explanation ?? null,
    });
  } catch (err: any) {
    res.status(StatusCodes.BAD_GATEWAY).json({
      message: 'Failed to fetch risk explanation',
      detail: err?.message,
    });
  }
}

// Proxy for POST /explain-risk used by explainRiskService
export async function postExplainRisk(req: Request, res: Response): Promise<void> {
  const body = req.body as { patient_id: string; model_type?: string };
  if (!body?.patient_id) {
    res
      .status(StatusCodes.UNPROCESSABLE_ENTITY)
      .json({ message: 'patient_id is required' });
    return;
  }
  try {
    const data = await callExplainRisk({
      patient_id: body.patient_id,
      model_type: 'graphsage',
    });
    res.json(data);
  } catch (err: any) {
    res.status(StatusCodes.BAD_GATEWAY).json({
      message: 'Failed to fetch explain risk',
      detail: err?.message,
    });
  }
}

