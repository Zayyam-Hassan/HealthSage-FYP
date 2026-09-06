import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  blockDoctorSlot,
  cancelDoctorAppointment,
  cancelPatientAppointment,
  completeDoctorAppointment,
  createDoctorAvailability,
  createPatientAppointment,
  deleteDoctorAvailability,
  generateDoctorSlots,
  getDoctorAppointments,
  getDoctorAvailability,
  getDoctorPublicSlots,
  getDoctorSlots,
  getPatientAppointments,
  getSchedulingAppointment,
  updateDoctorAvailability,
} from '../controllers/schedulingController';

const router = Router();

router.get('/appointments/:appointmentId', requireAuth, getSchedulingAppointment);

router.post(
  '/doctor/availability',
  requireAuth,
  requireRole('doctor'),
  createDoctorAvailability,
);
router.get(
  '/doctor/availability',
  requireAuth,
  requireRole('doctor'),
  getDoctorAvailability,
);
router.put(
  '/doctor/availability/:availabilityId',
  requireAuth,
  requireRole('doctor'),
  updateDoctorAvailability,
);
router.delete(
  '/doctor/availability/:availabilityId',
  requireAuth,
  requireRole('doctor'),
  deleteDoctorAvailability,
);
router.post(
  '/doctor/slots/generate',
  requireAuth,
  requireRole('doctor'),
  generateDoctorSlots,
);
router.get(
  '/doctor/slots',
  requireAuth,
  requireRole('doctor'),
  getDoctorSlots,
);
router.patch(
  '/doctor/slots/:slotId/block',
  requireAuth,
  requireRole('doctor'),
  blockDoctorSlot,
);
router.get(
  '/doctor/appointments',
  requireAuth,
  requireRole('doctor'),
  getDoctorAppointments,
);
router.patch(
  '/doctor/appointments/:appointmentId/cancel',
  requireAuth,
  requireRole('doctor'),
  cancelDoctorAppointment,
);
router.patch(
  '/doctor/appointments/:appointmentId/complete',
  requireAuth,
  requireRole('doctor'),
  completeDoctorAppointment,
);

router.get(
  '/doctors/:doctorId/slots',
  requireAuth,
  requireRole('patient'),
  getDoctorPublicSlots,
);
router.post(
  '/patient/appointments',
  requireAuth,
  requireRole('patient'),
  createPatientAppointment,
);
router.get(
  '/patient/appointments',
  requireAuth,
  requireRole('patient'),
  getPatientAppointments,
);
router.patch(
  '/patient/appointments/:appointmentId/cancel',
  requireAuth,
  requireRole('patient'),
  cancelPatientAppointment,
);

export { router as schedulingRouter };
