import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  createDoctorUploadedReport,
  createOverviewGeneratedReport,
  createPatientUploadedReport,
  createRiskSummaryGeneratedReport,
  createTreatmentSummaryGeneratedReport,
  downloadGeneratedReport,
  downloadUploadedReport,
  getDoctorPatientGeneratedReports,
  getDoctorPatientReportsSummary,
  getDoctorPatientUploadedReports,
  getGeneratedReport,
  getPatientGeneratedReports,
  getPatientReportsSummary,
  getPatientUploadedReports,
  shareGeneratedReport,
  getUploadedReport,
  removeUploadedReport,
} from '../controllers/reportModuleController';

const router = Router();

router.post('/uploaded/patient', requireAuth, requireRole('patient'), createPatientUploadedReport);
router.post(
  '/uploaded/doctor/:patientId',
  requireAuth,
  requireRole('doctor'),
  createDoctorUploadedReport,
);
router.get('/uploaded/patient', requireAuth, requireRole('patient'), getPatientUploadedReports);
router.get(
  '/uploaded/doctor/patients/:patientId',
  requireAuth,
  requireRole('doctor'),
  getDoctorPatientUploadedReports,
);
router.get('/uploaded/:reportId', requireAuth, getUploadedReport);
router.get('/uploaded/:reportId/file', requireAuth, downloadUploadedReport);
router.delete('/uploaded/:reportId', requireAuth, removeUploadedReport);

router.post(
  '/generated/patients/:patientId/risk-summary',
  requireAuth,
  requireRole('doctor'),
  createRiskSummaryGeneratedReport,
);
router.post(
  '/generated/patients/:patientId/treatment-summary',
  requireAuth,
  requireRole('doctor'),
  createTreatmentSummaryGeneratedReport,
);
router.post(
  '/generated/patients/:patientId/overview',
  requireAuth,
  requireRole('doctor'),
  createOverviewGeneratedReport,
);
router.get('/generated/patient', requireAuth, requireRole('patient'), getPatientGeneratedReports);
router.get(
  '/generated/doctor/patients/:patientId',
  requireAuth,
  requireRole('doctor'),
  getDoctorPatientGeneratedReports,
);
router.get('/generated/:reportId', requireAuth, getGeneratedReport);
router.get('/generated/:reportId/file', requireAuth, downloadGeneratedReport);
router.post(
  '/generated/:reportId/share',
  requireAuth,
  requireRole('doctor'),
  shareGeneratedReport,
);

router.get('/patient/overview', requireAuth, requireRole('patient'), getPatientReportsSummary);
router.get(
  '/doctor/patients/:patientId/overview',
  requireAuth,
  requireRole('doctor'),
  getDoctorPatientReportsSummary,
);

export { router as reportModuleRouter };
