import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getRiskExplain, postExplainRisk } from '../controllers/riskController';

const router = Router();

// GET /risk/{patient_id}/explain
router.get('/:patientId/explain', requireAuth, getRiskExplain);

// POST /explain-risk
router.post('/explain-risk', requireAuth, postExplainRisk);

export { router as riskRouter };

