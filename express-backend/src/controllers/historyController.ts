import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { Observation } from '../models/Observation';
import { Patient } from '../models/Patient';
import { RiskPrediction } from '../models/RiskPrediction';
import { canAccessPatient } from './patientsController';

const GLUCOSE_CODES = ['RANDOM_GLUCOSE', 'FASTING_GLUCOSE', 'HBA1C'];

const RANGE_DAYS: Record<string, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: null,
};

function scoreToLabel(score: number): 'low' | 'medium' | 'high' {
  if (score < 0.3) return 'low';
  if (score < 0.7) return 'medium';
  return 'high';
}

function normalizeScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 1 && value <= 100) return value / 100;
  return Math.min(Math.max(value, 0), 1);
}

function parseCodes(req: Request): string[] {
  const raw = req.query.codes;
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  }
  return GLUCOSE_CODES;
}

function parseRange(req: Request): { key: string; days: number | null } {
  const raw = typeof req.query.range === 'string' ? req.query.range : '';
  if (raw in RANGE_DAYS) {
    return { key: raw, days: RANGE_DAYS[raw] };
  }
  return { key: '30d', days: 30 };
}

async function resolvePatient(req: Request, res: Response, id: string) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return null;
  }
  const patient = await Patient.findById(id);
  if (!patient) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return null;
  }
  if (!(await canAccessPatient(req, patient))) {
    res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
    return null;
  }
  return patient;
}

// GET /mongo/patients/:id/glucose-history       (defaults to glucose codes)
// GET /mongo/patients/:id/observation-history?codes=HBA1C,BMI&range=90d
export async function getObservationHistory(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  try {
    const patient = await resolvePatient(req, res, id);
    if (!patient) return;

    const codes = parseCodes(req);
    const range = parseRange(req);
    const sinceMs =
      range.days === null
        ? 0
        : Date.now() - range.days * 24 * 60 * 60 * 1000;

    const observations = await Observation.find({
      patient_id: patient._id,
      observation_code: { $in: codes },
    }).sort({ effective_at: 1, created_at: 1 });

    const readings = observations
      .map((obs) => {
        const at = obs.effective_at ?? obs.created_at;
        return {
          code: obs.observation_code,
          value: obs.value_numeric ?? null,
          unit: obs.unit ?? null,
          recorded_at: at ? at.toISOString() : null,
          _at: at ? at.getTime() : 0,
        };
      })
      .filter((r) => r.value !== null && r._at >= sinceMs)
      .map(({ _at, ...rest }) => rest);

    res.json({
      patient_id: id,
      range: range.key,
      codes,
      readings,
    });
  } catch (err: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to load observation history',
      detail: err?.message,
    });
  }
}

// GET /risk/:patientId/history
export async function getRiskHistory(req: Request, res: Response): Promise<void> {
  const { patientId } = req.params;
  try {
    const patient = await resolvePatient(req, res, patientId);
    if (!patient) return;

    const predictions = await RiskPrediction.find({ patient_id: patient._id })
      .sort({ created_at: 1 })
      .limit(100);

    const history = predictions.map((pred) => {
      const score = normalizeScore(pred.probability ?? 0);
      const explanationLabel =
        typeof pred.explanation?.risk_label === 'string'
          ? String(pred.explanation.risk_label).toLowerCase()
          : null;
      const riskLabel =
        explanationLabel === 'low' ||
        explanationLabel === 'medium' ||
        explanationLabel === 'high'
          ? explanationLabel
          : scoreToLabel(score);
      return {
        date: pred.created_at ? pred.created_at.toISOString() : null,
        risk_score: score,
        risk_label: riskLabel,
        model_name: pred.model_name ?? 'GraphSAGE',
      };
    });

    res.json({ patient_id: patientId, history });
  } catch (err: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to load risk history',
      detail: err?.message,
    });
  }
}
