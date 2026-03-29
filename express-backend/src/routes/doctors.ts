import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  getAssignmentRequests,
  getDoctor,
  getDoctorMe,
  getMyPatients,
  listDoctors,
  requestDoctorAssignment,
  respondToAssignmentRequest,
} from '../controllers/doctorsController';

const router = Router();

// Matches frontend base: /mongo/doctors
router.get('/', requireAuth, listDoctors);
router.get('/me', requireAuth, requireRole('doctor'), getDoctorMe);
router.get('/my-patients', requireAuth, requireRole('doctor'), getMyPatients);
router.get(
  '/assignment-requests',
  requireAuth,
  requireRole('doctor'),
  getAssignmentRequests,
);
router.post(
  '/:id/assignment-requests',
  requireAuth,
  requireRole('patient'),
  requestDoctorAssignment,
);
router.patch(
  '/assignment-requests/:requestId',
  requireAuth,
  requireRole('doctor'),
  respondToAssignmentRequest,
);
router.get('/:id', requireAuth, getDoctor);

export { router as doctorsRouter };

