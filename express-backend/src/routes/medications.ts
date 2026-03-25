import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getMedication, listMedications } from '../controllers/medicationsController';

const router = Router();

// Matches frontend base: /mongo/medications
router.get('/', requireAuth, listMedications);
router.get('/:id', requireAuth, getMedication);

export { router as medicationsRouter };

