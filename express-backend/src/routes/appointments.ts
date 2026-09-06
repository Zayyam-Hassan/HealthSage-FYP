import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  listAppointments,
  updateAppointment,
} from '../controllers/appointmentsController';

const router = Router();

// Matches frontend base: /mongo/appointments
router.post('/', requireAuth, createAppointment);
router.get('/', requireAuth, listAppointments);
router.get('/:id', requireAuth, getAppointment);
router.patch('/:id', requireAuth, updateAppointment);
router.delete('/:id', requireAuth, deleteAppointment);

export { router as appointmentsRouter };

