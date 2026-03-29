import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  compareWhatIfRisk,
  getWhatIfBaseline,
} from '../controllers/whatIfController';

const router = Router();

router.get(
  '/patients/:patientId/baseline',
  requireAuth,
  requireRole(['doctor', 'admin']),
  getWhatIfBaseline,
);

router.post(
  '/patients/:patientId/risk/compare',
  requireAuth,
  requireRole(['doctor', 'admin']),
  compareWhatIfRisk,
);

export { router as whatIfRouter };
