import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import {
  createReport,
  downloadReportFile,
  deleteReport,
  getReport,
  listReports,
  sendReportToPatient,
  updateReport,
} from '../controllers/reportsController';

const router = Router();

// Matches frontend base: /mongo/reports
router.post('/', requireAuth, createReport);
router.get('/', requireAuth, listReports);
router.post('/:id/send', requireAuth, sendReportToPatient);
router.get('/:id/file', requireAuth, downloadReportFile);
router.get('/:id', requireAuth, getReport);
router.patch('/:id', requireAuth, updateReport);
router.delete('/:id', requireAuth, deleteReport);

export { router as reportsRouter };

