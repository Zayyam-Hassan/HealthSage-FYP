import { Router } from 'express';
import { getCompatibility } from '../controllers/compatibilityController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/:patientId/:medicationId', requireAuth, getCompatibility);

export { router as compatibilityRouter };

