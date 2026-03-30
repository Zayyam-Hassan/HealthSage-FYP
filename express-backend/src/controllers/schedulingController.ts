import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { appointmentSlotStatuses } from '../models/AppointmentSlot';
import { scheduledAppointmentStatuses } from '../models/ScheduledAppointment';
import { weekdayValues } from '../models/DoctorAvailability';
import {
  SchedulingError,
  blockDoctorSlotForUser,
  bookAppointmentForPatientUser,
  cancelAppointmentForUser,
  completeAppointmentForDoctorUser,
  createDoctorAvailabilityForUser,
  deleteDoctorAvailabilityForUser,
  generateSlotsForDoctorUser,
  getAppointmentForUser,
  listDoctorAppointmentsForUser,
  listDoctorAvailabilityForUser,
  listDoctorSlotsForUser,
  listPatientAppointmentsForUser,
  listPatientVisibleSlots,
  updateDoctorAvailabilityForUser,
} from '../services/schedulingService';

const AvailabilitySchema = z.object({
  weekday: z.enum(weekdayValues),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  slot_duration_minutes: z.number().int().positive(),
  break_start_time: z.string().min(1).optional().nullable(),
  break_end_time: z.string().min(1).optional().nullable(),
  is_active: z.boolean().optional(),
});

const GenerateSlotsSchema = z.object({
  days_ahead: z.number().int().positive().max(31).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const SlotQuerySchema = z.object({
  days_ahead: z.coerce.number().int().positive().max(31).optional(),
  status: z.enum(appointmentSlotStatuses).optional(),
});

const AppointmentQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(scheduledAppointmentStatuses).optional(),
});

const BookAppointmentSchema = z.object({
  slot_id: z.string().min(1),
  reason_for_visit: z.string().max(500).optional(),
  patient_note: z.string().max(1000).optional(),
});

const CompleteAppointmentSchema = z.object({
  doctor_note: z.string().max(1000).optional(),
});

function handleError(res: Response, error: unknown): void {
  if (error instanceof SchedulingError) {
    res.status(error.status).json({
      message: error.message,
      detail: error.detail,
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid scheduling payload',
      detail: error.flatten(),
    });
    return;
  }

  throw error;
}

export async function createDoctorAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = AvailabilitySchema.parse(req.body);
    const item = await createDoctorAvailabilityForUser(req.user!.sub, payload);
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await listDoctorAvailabilityForUser(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateDoctorAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = AvailabilitySchema.parse(req.body);
    res.json(
      await updateDoctorAvailabilityForUser(
        req.user!.sub,
        req.params.availabilityId,
        payload,
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteDoctorAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    await deleteDoctorAvailabilityForUser(req.user!.sub, req.params.availabilityId);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    handleError(res, error);
  }
}

export async function generateDoctorSlots(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = GenerateSlotsSchema.parse(req.body ?? {});
    res.json(await generateSlotsForDoctorUser(req.user!.sub, payload));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorSlots(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const query = SlotQuerySchema.parse(req.query);
    res.json(await listDoctorSlotsForUser(req.user!.sub, query));
  } catch (error) {
    handleError(res, error);
  }
}

export async function blockDoctorSlot(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await blockDoctorSlotForUser(req.user!.sub, req.params.slotId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorAppointments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const query = AppointmentQuerySchema.parse(req.query);
    res.json(await listDoctorAppointmentsForUser(req.user!.sub, query));
  } catch (error) {
    handleError(res, error);
  }
}

export async function cancelDoctorAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await cancelAppointmentForUser(req.user!, req.params.appointmentId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function completeDoctorAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = CompleteAppointmentSchema.parse(req.body ?? {});
    res.json(
      await completeAppointmentForDoctorUser(
        req.user!.sub,
        req.params.appointmentId,
        payload,
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorPublicSlots(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const query = SlotQuerySchema.parse(req.query);
    res.json(
      await listPatientVisibleSlots(req.user!.sub, {
        doctor_id: req.params.doctorId,
        days_ahead: query.days_ahead,
        status: query.status,
      }),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function createPatientAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = BookAppointmentSchema.parse(req.body);
    const appointment = await bookAppointmentForPatientUser(req.user!.sub, payload);
    res.status(StatusCodes.CREATED).json(appointment);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientAppointments(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const query = AppointmentQuerySchema.parse(req.query);
    res.json(await listPatientAppointmentsForUser(req.user!.sub, query));
  } catch (error) {
    handleError(res, error);
  }
}

export async function cancelPatientAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await cancelAppointmentForUser(req.user!, req.params.appointmentId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getSchedulingAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getAppointmentForUser(req.user!, req.params.appointmentId));
  } catch (error) {
    handleError(res, error);
  }
}
