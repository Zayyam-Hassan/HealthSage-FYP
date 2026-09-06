import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  completeDoctorTreatmentPlan,
  createDoctorTreatmentPlan,
  discontinueDoctorTreatmentPlan,
  getDoctorActiveTreatmentSummary,
  getDoctorTreatmentPlanById,
  getPatientActiveTreatmentPlan,
  getPatientTreatmentHistory,
  getPatientTreatmentPlanById,
  listDoctorTreatmentPlans,
  updateDoctorTreatmentPlan,
} from '../controllers/doctorTreatmentController';

const router = Router();

router.post(
  '/patients/:patientId',
  requireAuth,
  requireRole('doctor'),
  createDoctorTreatmentPlan,
);
router.get(
  '/patients/:patientId/active/summary',
  requireAuth,
  requireRole('doctor'),
  getDoctorActiveTreatmentSummary,
);
router.get(
  '/patients/:patientId',
  requireAuth,
  requireRole('doctor'),
  listDoctorTreatmentPlans,
);
router.get(
  '/:treatmentPlanId',
  requireAuth,
  requireRole('doctor'),
  getDoctorTreatmentPlanById,
);
router.put(
  '/:treatmentPlanId',
  requireAuth,
  requireRole('doctor'),
  updateDoctorTreatmentPlan,
);
router.patch(
  '/:treatmentPlanId/discontinue',
  requireAuth,
  requireRole('doctor'),
  discontinueDoctorTreatmentPlan,
);
router.patch(
  '/:treatmentPlanId/complete',
  requireAuth,
  requireRole('doctor'),
  completeDoctorTreatmentPlan,
);

router.get(
  '/patient/active',
  requireAuth,
  requireRole('patient'),
  getPatientActiveTreatmentPlan,
);
router.get(
  '/patient/history',
  requireAuth,
  requireRole('patient'),
  getPatientTreatmentHistory,
);
router.get(
  '/patient/:treatmentPlanId',
  requireAuth,
  requireRole('patient'),
  getPatientTreatmentPlanById,
);

export { router as doctorTreatmentRouter };
