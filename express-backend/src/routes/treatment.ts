import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  createDoctorLifestylePlan,
  createDoctorPrescription,
  discontinueDoctorLifestylePlan,
  discontinueDoctorPrescription,
  getDoctorLifestylePlanById,
  getDoctorPatientLifestylePlans,
  getDoctorPatientPrescriptions,
  getDoctorPrescriptionById,
  getPatientActiveLifestylePlans,
  getPatientActivePrescriptions,
  getPatientLifestylePlans,
  getPatientPrescriptions,
  getPatientTreatmentOverviewSummary,
  updateDoctorLifestylePlan,
  updateDoctorPrescription,
} from '../controllers/treatmentController';

const router = Router();

router.post(
  '/doctor/patients/:patientId/prescriptions',
  requireAuth,
  requireRole('doctor'),
  createDoctorPrescription,
);
router.get(
  '/doctor/patients/:patientId/prescriptions',
  requireAuth,
  requireRole('doctor'),
  getDoctorPatientPrescriptions,
);
router.get(
  '/doctor/prescriptions/:prescriptionId',
  requireAuth,
  requireRole('doctor'),
  getDoctorPrescriptionById,
);
router.put(
  '/doctor/prescriptions/:prescriptionId',
  requireAuth,
  requireRole('doctor'),
  updateDoctorPrescription,
);
router.patch(
  '/doctor/prescriptions/:prescriptionId/discontinue',
  requireAuth,
  requireRole('doctor'),
  discontinueDoctorPrescription,
);

router.post(
  '/doctor/patients/:patientId/lifestyle-plans',
  requireAuth,
  requireRole('doctor'),
  createDoctorLifestylePlan,
);
router.get(
  '/doctor/patients/:patientId/lifestyle-plans',
  requireAuth,
  requireRole('doctor'),
  getDoctorPatientLifestylePlans,
);
router.get(
  '/doctor/lifestyle-plans/:planId',
  requireAuth,
  requireRole('doctor'),
  getDoctorLifestylePlanById,
);
router.put(
  '/doctor/lifestyle-plans/:planId',
  requireAuth,
  requireRole('doctor'),
  updateDoctorLifestylePlan,
);
router.patch(
  '/doctor/lifestyle-plans/:planId/discontinue',
  requireAuth,
  requireRole('doctor'),
  discontinueDoctorLifestylePlan,
);

router.get(
  '/patient/prescriptions/active',
  requireAuth,
  requireRole('patient'),
  getPatientActivePrescriptions,
);
router.get(
  '/patient/prescriptions',
  requireAuth,
  requireRole('patient'),
  getPatientPrescriptions,
);
router.get(
  '/patient/lifestyle-plans/active',
  requireAuth,
  requireRole('patient'),
  getPatientActiveLifestylePlans,
);
router.get(
  '/patient/lifestyle-plans',
  requireAuth,
  requireRole('patient'),
  getPatientLifestylePlans,
);
router.get(
  '/patient/overview',
  requireAuth,
  requireRole('patient'),
  getPatientTreatmentOverviewSummary,
);

export { router as treatmentRouter };
