import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { callCompatibility } from '../integrations/fastapi/client';

export async function getCompatibility(
  req: Request,
  res: Response,
): Promise<void> {
  const { patientId, medicationId } = req.params;

  if (!patientId || !medicationId) {
    res
      .status(StatusCodes.UNPROCESSABLE_ENTITY)
      .json({ message: 'patientId and medicationId are required' });
    return;
  }

  try {
    const data = await callCompatibility(patientId, medicationId);
    res.json(data);
  } catch (err: any) {
    res.status(StatusCodes.BAD_GATEWAY).json({
      message: 'Failed to fetch compatibility result',
      detail: err?.message,
    });
  }
}

