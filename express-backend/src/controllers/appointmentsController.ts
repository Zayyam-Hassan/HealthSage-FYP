import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';

async function getDoctorByUser(userId: string) {
  return Doctor.findOne({ user_id: new mongoose.Types.ObjectId(userId) });
}

async function getPatientByUser(userId: string) {
  return Patient.findOne({ user_id: new mongoose.Types.ObjectId(userId) });
}

async function getAccessibleAppointment(
  req: Request,
  id: string,
): Promise<{ appointment: any | null; doctor: any | null; patient: any | null }> {
  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return { appointment: null, doctor: null, patient: null };
  }

  const [doctor, patient] = await Promise.all([
    Doctor.findById(appointment.doctor_id),
    Patient.findById(appointment.patient_id),
  ]);

  if (!req.user || !doctor || !patient) {
    return { appointment: null, doctor: null, patient: null };
  }

  if (req.user.role === 'admin') {
    return { appointment, doctor, patient };
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user_id?.toString() === req.user.sub
  ) {
    return { appointment, doctor, patient };
  }

  if (
    req.user.role === 'patient' &&
    patient.user_id?.toString() === req.user.sub
  ) {
    return { appointment, doctor, patient };
  }

  return { appointment: null, doctor: null, patient: null };
}

function mapAppointment(doc: any, patientName?: string, doctorName?: string) {
  const proposedSlots = Array.isArray(doc.proposed_slots)
    ? doc.proposed_slots.map((slot: Date) => slot.toISOString())
    : [];
  const displaySlot = doc.scheduled_at ?? doc.proposed_slots?.[0] ?? null;

  return {
    id: doc.id,
    patient_id:
      typeof doc.patient_id === 'string'
        ? doc.patient_id
        : (doc.patient_id as mongoose.Types.ObjectId)?.toString(),
    doctor_id:
      typeof doc.doctor_id === 'string'
        ? doc.doctor_id
        : (doc.doctor_id as mongoose.Types.ObjectId)?.toString(),
    patient_name: patientName,
    doctor_name: doctorName,
    counterpart_name: doctorName ?? patientName,
    proposed_slots: proposedSlots,
    scheduled_at: doc.scheduled_at ? doc.scheduled_at.toISOString() : null,
    requested_by_role: doc.requested_by_role,
    status: doc.status,
    reason: doc.reason ?? '',
    notes: doc.notes,
    response_message: doc.response_message,
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
    display_date: displaySlot
      ? new Date(displaySlot).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null,
    display_time: displaySlot
      ? new Date(displaySlot).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null,
  };
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    patient_id: string;
    doctor_id: string;
    proposed_slots?: string[];
    scheduled_at?: string;
    requested_by_role?: 'patient' | 'doctor';
    reason: string;
    notes?: string;
  };

  const proposedSlots =
    Array.isArray(body.proposed_slots) && body.proposed_slots.length > 0
      ? body.proposed_slots
      : body.scheduled_at
        ? [body.scheduled_at]
        : [];

  if (!body.patient_id || !body.doctor_id || proposedSlots.length === 0 || !body.reason) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: 'Missing required fields' });
    return;
  }

  if (req.user?.role === 'doctor') {
    res.status(StatusCodes.FORBIDDEN).json({
      message: 'Doctors can review and respond to appointment requests, but patients must create them.',
    });
    return;
  }

  const [patient, doctor] = await Promise.all([
    Patient.findById(body.patient_id),
    Doctor.findById(body.doctor_id),
  ]);

  if (!patient || !doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Doctor or patient not found' });
    return;
  }

  if (req.user?.role === 'patient') {
    if (patient.user_id?.toString() !== req.user.sub) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }
    if (patient.primary_doctor_id?.toString() !== doctor.id) {
      res.status(StatusCodes.CONFLICT).json({
        message: 'Appointments can only be requested with your assigned doctor',
      });
      return;
    }
  }

  const appointment = await Appointment.create({
    patient_id: new mongoose.Types.ObjectId(body.patient_id),
    doctor_id: new mongoose.Types.ObjectId(body.doctor_id),
    proposed_slots: proposedSlots.map((slot) => new Date(slot)),
    requested_by_role: 'patient',
    status: 'pending',
    reason: body.reason,
    notes: body.notes,
  });

  res.status(StatusCodes.CREATED).json(
    mapAppointment(appointment, patient?.full_name, doctor?.name),
  );
}

export async function listAppointments(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1) || 1;
  const limit = Number(req.query.limit ?? 20) || 20;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const filter: Record<string, unknown> = {};

  if (req.user?.role === 'doctor') {
    const doctor = await getDoctorByUser(req.user.sub);
    if (!doctor) {
      res.json({ items: [], total: 0, page, limit, pages: 0 });
      return;
    }
    filter.doctor_id = doctor._id;
  } else if (req.user?.role === 'patient') {
    const patient = await getPatientByUser(req.user.sub);
    if (!patient) {
      res.json({ items: [], total: 0, page, limit, pages: 0 });
      return;
    }
    filter.patient_id = patient._id;
  } else {
    const patient_id =
      typeof req.query.patient_id === 'string' ? req.query.patient_id : undefined;
    const doctor_id =
      typeof req.query.doctor_id === 'string' ? req.query.doctor_id : undefined;
    if (patient_id && mongoose.isValidObjectId(patient_id)) {
      filter.patient_id = new mongoose.Types.ObjectId(patient_id);
    }
    if (doctor_id && mongoose.isValidObjectId(doctor_id)) {
      filter.doctor_id = new mongoose.Types.ObjectId(doctor_id);
    }
  }

  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Appointment.countDocuments(filter),
  ]);

  const patientIds = [...new Set(items.map((item) => item.patient_id.toString()))];
  const doctorIds = [...new Set(items.map((item) => item.doctor_id.toString()))];
  const [patients, doctors] = await Promise.all([
    Patient.find({ _id: { $in: patientIds } }),
    Doctor.find({ _id: { $in: doctorIds } }),
  ]);
  const patientMap = new Map(patients.map((patient) => [patient.id, patient.full_name]));
  const doctorMap = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

  res.json({
    items: items.map((item) =>
      mapAppointment(
        item,
        patientMap.get(item.patient_id.toString()),
        doctorMap.get(item.doctor_id.toString()),
      ),
    ),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

export async function getAppointment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Appointment not found' });
    return;
  }

  const { appointment, patient, doctor } = await getAccessibleAppointment(req, id);
  if (!appointment || !patient || !doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Appointment not found' });
    return;
  }

  res.json(mapAppointment(appointment, patient?.full_name, doctor?.name));
}

export async function updateAppointment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Appointment not found' });
    return;
  }

  const { appointment, patient, doctor } = await getAccessibleAppointment(req, id);
  if (!appointment || !patient || !doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Appointment not found' });
    return;
  }

  const body = req.body as {
    proposed_slots?: string[];
    selected_slot?: string;
    status?: string;
    reason?: string;
    notes?: string;
    response_message?: string;
  };

  if (Array.isArray(body.proposed_slots) && body.proposed_slots.length > 0) {
    if (
      req.user?.role !== 'admin' &&
      appointment.requested_by_role !== req.user?.role
    ) {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only the request owner can change proposed slots',
      });
      return;
    }
    appointment.proposed_slots = body.proposed_slots.map((slot) => new Date(slot));
    appointment.scheduled_at = null;
    appointment.status = 'pending';
  }

  if (body.selected_slot) {
    if (
      req.user?.role !== 'admin' &&
      appointment.requested_by_role === req.user?.role
    ) {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only the other party can confirm a proposed slot',
      });
      return;
    }
    const slotIsValid = appointment.proposed_slots.some(
      (slot: Date) => slot.toISOString() === new Date(body.selected_slot as string).toISOString(),
    );
    if (!slotIsValid) {
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
        message: 'Selected slot must match one of the proposed slots',
      });
      return;
    }
    appointment.scheduled_at = new Date(body.selected_slot);
    appointment.status = 'confirmed';
  } else if (body.status) {
    if (
      ['confirmed', 'rejected'].includes(body.status) &&
      req.user?.role !== 'admin' &&
      appointment.requested_by_role === req.user?.role
    ) {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only the other party can confirm or reject this request',
      });
      return;
    }
    appointment.status = body.status;
  }

  if (body.reason !== undefined) appointment.reason = body.reason;
  if (body.notes !== undefined) appointment.notes = body.notes;
  if (body.response_message !== undefined) {
    appointment.response_message = body.response_message;
  }

  await appointment.save();
  res.json(mapAppointment(appointment, patient?.full_name, doctor?.name));
}

export async function deleteAppointment(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Appointment not found' });
    return;
  }

  const { appointment } = await getAccessibleAppointment(req, id);
  if (!appointment) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Appointment not found' });
    return;
  }

  await Appointment.findByIdAndDelete(id);
  res.status(StatusCodes.NO_CONTENT).send();
}
