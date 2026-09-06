import { StatusCodes } from 'http-status-codes';
import type { Request, Response } from 'express';
import { getRiskExplain, postExplainRisk } from '../../controllers/riskController';
import {
  callExplainRisk,
  callRiskExplain,
  callRiskPrediction,
} from '../../integrations/fastapi/client';

jest.mock('../../integrations/fastapi/client', () => ({
  callRiskPrediction: jest.fn(),
  callRiskExplain: jest.fn(),
  callExplainRisk: jest.fn(),
}));

function buildRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

describe('riskController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges prediction and explanation payload', async () => {
    (callRiskPrediction as jest.Mock).mockResolvedValue({
      patient_id: 'p1',
      risk_score: 0.8,
      risk_label: 'high',
      predicted_label: 1,
    });
    (callRiskExplain as jest.Mock).mockResolvedValue({
      explanation_available: true,
      explanation: { top_factors: ['hba1c'] },
    });
    const req = { params: { patientId: 'p1' } } as unknown as Request;
    const { res, json } = buildRes();

    await getRiskExplain(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_id: 'p1',
        risk_score: 0.8,
        risk_label: 'high',
        explanation_available: true,
      }),
    );
  });

  it('returns 502 when prediction fails', async () => {
    (callRiskPrediction as jest.Mock).mockRejectedValue(new Error('fastapi unavailable'));
    const req = { params: { patientId: 'p1' } } as unknown as Request;
    const { res, status, json } = buildRes();

    await getRiskExplain(req, res);

    expect(status).toHaveBeenCalledWith(StatusCodes.BAD_GATEWAY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to fetch risk explanation' }),
    );
  });

  it('falls back when explain call fails but prediction succeeds', async () => {
    (callRiskPrediction as jest.Mock).mockResolvedValue({ patient_id: 'p3', risk_score: 0.2 });
    (callRiskExplain as jest.Mock).mockRejectedValue(new Error('no explain'));
    const req = { params: { patientId: 'p3' } } as unknown as Request;
    const { res, json } = buildRes();

    await getRiskExplain(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_id: 'p3',
        risk_label: 'low',
      }),
    );
  });

  it('uses explanation fallback fields when prediction fields missing', async () => {
    (callRiskPrediction as jest.Mock).mockResolvedValue({});
    (callRiskExplain as jest.Mock).mockResolvedValue({
      patient_id: 'p4',
      risk_score: 0.45,
      risk_label: 'medium',
      predicted_label: 0,
      model_name: 'GraphSAGE',
      explanation_available: true,
      explanation: { note: 'fallback' },
    });
    const req = { params: { patientId: 'p4' } } as unknown as Request;
    const { res, json } = buildRes();
    await getRiskExplain(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_id: 'p4',
        risk_score: 0.45,
        risk_label: 'medium',
      }),
    );
  });

  it('uses request patientId and default score when both payloads miss fields', async () => {
    (callRiskPrediction as jest.Mock).mockResolvedValue({});
    (callRiskExplain as jest.Mock).mockResolvedValue({});
    const req = { params: { patientId: 'p-fallback' } } as unknown as Request;
    const { res, json } = buildRes();

    await getRiskExplain(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        patient_id: 'p-fallback',
        risk_score: 0,
      }),
    );
  });

  it('validates patient_id for explain-risk endpoint', async () => {
    const req = { body: {} } as Request;
    const { res, status, json } = buildRes();

    await postExplainRisk(req, res);

    expect(status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith({ message: 'patient_id is required' });
  });

  it('proxies explain-risk request and returns payload', async () => {
    (callExplainRisk as jest.Mock).mockResolvedValue({ explanation: 'ok' });
    const req = { body: { patient_id: 'p2' } } as Request;
    const { res, json } = buildRes();

    await postExplainRisk(req, res);

    expect(callExplainRisk).toHaveBeenCalledWith({
      patient_id: 'p2',
      model_type: 'graphsage',
    });
    expect(json).toHaveBeenCalledWith({ explanation: 'ok' });
  });

  it('returns 502 when explain-risk proxy fails', async () => {
    (callExplainRisk as jest.Mock).mockRejectedValue(new Error('timeout'));
    const req = { body: { patient_id: 'p2' } } as Request;
    const { res, status, json } = buildRes();
    await postExplainRisk(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.BAD_GATEWAY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to fetch explain risk' }),
    );
  });
});
