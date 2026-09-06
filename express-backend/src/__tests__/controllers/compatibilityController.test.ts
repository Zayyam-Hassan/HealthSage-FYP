import { StatusCodes } from 'http-status-codes';
import type { Request, Response } from 'express';
import { getCompatibility } from '../../controllers/compatibilityController';
import { callCompatibility } from '../../integrations/fastapi/client';

jest.mock('../../integrations/fastapi/client', () => ({
  callCompatibility: jest.fn(),
}));

function buildRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

describe('compatibilityController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 422 when required params are missing', async () => {
    const req = { params: { patientId: '', medicationId: '' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await getCompatibility(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith({ message: 'patientId and medicationId are required' });
  });

  it('returns compatibility payload', async () => {
    (callCompatibility as jest.Mock).mockResolvedValue({ compatibility_score: 0.9 });
    const req = { params: { patientId: 'p1', medicationId: 'm1' } } as unknown as Request;
    const { res, json } = buildRes();
    await getCompatibility(req, res);
    expect(json).toHaveBeenCalledWith({ compatibility_score: 0.9 });
  });

  it('maps downstream errors to 502', async () => {
    (callCompatibility as jest.Mock).mockRejectedValue(new Error('fastapi unavailable'));
    const req = { params: { patientId: 'p1', medicationId: 'm1' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await getCompatibility(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.BAD_GATEWAY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to fetch compatibility result' }),
    );
  });
});
