import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  compareWhatIfForDoctor,
  getWhatIfBaselineForDoctor,
} from '../services/whatIfService';

export async function getWhatIfBaseline(req: Request, res: Response): Promise<void> {
  const { patientId } = req.params;

  try {
    const result = await getWhatIfBaselineForDoctor(req.user, patientId);
    if (!result) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    const detail = err?.response?.data?.detail ?? err?.message;
    const status = Number(err?.response?.status) || StatusCodes.BAD_GATEWAY;
    res.status(status).json({
      message: 'Failed to build what-if baseline',
      detail,
    });
  }
}

export async function compareWhatIfRisk(req: Request, res: Response): Promise<void> {
  const { patientId } = req.params;
  const payload = req.body as {
    scenario_name?: string;
    modifications?: Record<string, unknown>;
  };

  if (!payload?.modifications || Object.keys(payload.modifications).length === 0) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'modifications must not be empty',
    });
    return;
  }

  try {
    const result = await compareWhatIfForDoctor(req.user, patientId, {
      scenario_name: payload.scenario_name,
      modifications: payload.modifications,
    });
    if (!result) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    const detail = err?.response?.data?.detail ?? err?.message;
    const status = Number(err?.response?.status) || StatusCodes.BAD_GATEWAY;
    res.status(status).json({
      message: 'Failed to compare what-if scenario',
      detail,
    });
  }
}
