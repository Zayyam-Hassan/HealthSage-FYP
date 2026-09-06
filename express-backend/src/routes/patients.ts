import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  createPatient,
  deletePatient,
  getPatient,
  getPatientMe,
  listPatients,
  updateMyClinicalProfile,
  updatePatient,
} from '../controllers/patientsController';
import { getObservationHistory } from '../controllers/historyController';

const router = Router();

// Keep endpoint shape aligned with existing frontend: /mongo/patients
router.get('/', requireAuth, listPatients);
router.get('/me', requireAuth, requireRole('patient'), getPatientMe);
router.patch(
  '/me/clinical-profile',
  requireAuth,
  requireRole('patient'),
  updateMyClinicalProfile,
);
router.post('/', requireAuth, requireRole(['doctor', 'admin']), createPatient);
router.get('/:id', requireAuth, getPatient);
router.get('/:id/glucose-history', requireAuth, getObservationHistory);
router.get('/:id/observation-history', requireAuth, getObservationHistory);
router.patch('/:id', requireAuth, updatePatient);
router.delete('/:id', requireAuth, requireRole(['doctor', 'admin']), deletePatient);

export { router as patientsRouter };

