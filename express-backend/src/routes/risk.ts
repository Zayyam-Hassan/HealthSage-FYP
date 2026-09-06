import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getRiskExplain, postExplainRisk } from '../controllers/riskController';
import { getRiskHistory } from '../controllers/historyController';

const router = Router();

// GET /risk/{patient_id}/explain
router.get('/:patientId/explain', requireAuth, getRiskExplain);

// GET /risk/{patient_id}/history
router.get('/:patientId/history', requireAuth, getRiskHistory);

// POST /explain-risk
router.post('/explain-risk', requireAuth, postExplainRisk);

export { router as riskRouter };

