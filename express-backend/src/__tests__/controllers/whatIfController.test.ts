import { StatusCodes } from 'http-status-codes';
import type { Request, Response } from 'express';
import { compareWhatIfRisk, getWhatIfBaseline } from '../../controllers/whatIfController';
import { compareWhatIfForDoctor, getWhatIfBaselineForDoctor } from '../../services/whatIfService';

jest.mock('../../services/whatIfService', () => ({
  getWhatIfBaselineForDoctor: jest.fn(),
  compareWhatIfForDoctor: jest.fn(),
}));

function buildRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

describe('whatIfController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns baseline data', async () => {
    (getWhatIfBaselineForDoctor as jest.Mock).mockResolvedValue({ baseline: { risk_score: 0.1 } });
    const req = { params: { patientId: 'p1' }, user: { sub: 'd1' } } as unknown as Request;
    const { res, json } = buildRes();
    await getWhatIfBaseline(req, res);
    expect(json).toHaveBeenCalledWith({ baseline: { risk_score: 0.1 } });
  });

  it('returns 403 when baseline authorization fails', async () => {
    (getWhatIfBaselineForDoctor as jest.Mock).mockResolvedValue(null);
    const req = { params: { patientId: 'p1' }, user: { sub: 'd1' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await getWhatIfBaseline(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({ message: 'Forbidden' });
  });

  it('returns 422 when compare payload has empty modifications', async () => {
    const req = { params: { patientId: 'p1' }, body: {} } as unknown as Request;
    const { res, status, json } = buildRes();
    await compareWhatIfRisk(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith({ message: 'modifications must not be empty' });
  });

  it('returns compare result when authorized', async () => {
    (compareWhatIfForDoctor as jest.Mock).mockResolvedValue({ scenario: { risk_score: 0.5 } });
    const req = {
      params: { patientId: 'p1' },
      user: { sub: 'd1' },
      body: { scenario_name: 'test', modifications: { BMI: 25 } },
    } as unknown as Request;
    const { res, json } = buildRes();
    await compareWhatIfRisk(req, res);
    expect(json).toHaveBeenCalledWith({ scenario: { risk_score: 0.5 } });
  });

  it('maps downstream compare error to response', async () => {
    (compareWhatIfForDoctor as jest.Mock).mockRejectedValue({
      response: { status: 422, data: { detail: 'invalid scenario' } },
    });
    const req = {
      params: { patientId: 'p1' },
      user: { sub: 'd1' },
      body: { modifications: { BMI: 25 } },
    } as unknown as Request;
    const { res, status, json } = buildRes();
    await compareWhatIfRisk(req, res);
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to compare what-if scenario' }),
    );
  });
});
