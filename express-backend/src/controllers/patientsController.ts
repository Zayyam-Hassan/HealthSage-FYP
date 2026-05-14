import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { Doctor } from '../models/Doctor';
import { DoctorAssignmentRequest } from '../models/DoctorAssignmentRequest';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import {
  buildPatientPayload,
  buildPatientUpdate,
  syncPatientClinicalCollections,
  type PatientProfilePayload,
} from '../utils/patientProfile';

async function getCurrentDoctorProfile(userId: string) {
  return Doctor.findOne({ user_id: new mongoose.Types.ObjectId(userId) });
}

async function getCurrentPatientProfile(userId: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  let patient = await Patient.findOne({ user_id: userObjectId });
  if (!patient) {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }
    patient = await Patient.create({
      user_id: userObjectId,
      patient_id: `PT-${userId.slice(-6).toUpperCase()}`,
      full_name: user.display_name,
      conditions: [],
    });
  }
  return patient;
}

async function loadDoctorForPatient(patient: any) {
  if (!patient.primary_doctor_id) {
    return null;
  }
  return Doctor.findById(patient.primary_doctor_id);
}

async function loadPendingRequest(patientId: mongoose.Types.ObjectId) {
  return DoctorAssignmentRequest.findOne({
    patient_id: patientId,
    status: 'pending',
  }).sort({ created_at: -1 });
}

async function mapPatient(patient: any, options?: { is_self?: boolean }) {
  const [doctor, pendingRequest] = await Promise.all([
    loadDoctorForPatient(patient),
    loadPendingRequest(patient._id),
  ]);

  return buildPatientPayload(patient, {
    doctor,
    pendingRequest,
    is_self: options?.is_self,
  });
}

function parsePagination(req: Request) {
  const page = Number(req.query.page ?? 1) || 1;
  const limit = Number(req.query.limit ?? 20) || 20;
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : '';

  return { page, limit, search };
}

export async function listPatients(req: Request, res: Response): Promise<void> {
  const { page, limit, search } = parsePagination(req);
  const filter: Record<string, unknown> = {};

  if (search) {
    filter.$or = [
      { full_name: { $regex: search, $options: 'i' } },
      { patient_id: { $regex: search, $options: 'i' } },
      { conditions: { $regex: search, $options: 'i' } },
    ];
  }

  if (req.user?.role === 'doctor') {
    const doctor = await getCurrentDoctorProfile(req.user.sub);
    if (!doctor) {
      res.json({ items: [], total: 0, page, limit, pages: 0 });
      return;
    }
    filter.primary_doctor_id = doctor._id;
  }

  if (req.user?.role === 'patient') {
    const patient = await getCurrentPatientProfile(req.user.sub);
    if (!patient) {
      res.json({ items: [], total: 0, page, limit, pages: 0 });
      return;
    }
    filter._id = patient._id;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Patient.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Patient.countDocuments(filter),
  ]);

  const mapped = await Promise.all(
    items.map((patient) =>
      mapPatient(patient, {
        is_self:
          req.user?.role === 'patient' &&
          patient.user_id?.toString() === req.user.sub,
      }),
    ),
  );

  res.json({
    items: mapped,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

export async function createPatient(req: Request, res: Response): Promise<void> {
  const body = req.body as PatientProfilePayload & {
    patient_id?: string;
    full_name?: string;
  };

  const patient = await Patient.create({
    patient_id: body.patient_id?.trim() || undefined,
    full_name: body.full_name?.trim() || 'New Patient',
    ...buildPatientUpdate(body),
  });

  await syncPatientClinicalCollections(patient._id, patient.toObject());

  const payload = await mapPatient(patient);
  res.status(StatusCodes.CREATED).json(payload);
}

export async function getPatientMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const patient = await getCurrentPatientProfile(req.user.sub);
  if (!patient) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient profile not found' });
    return;
  }

  res.json(await mapPatient(patient, { is_self: true }));
}

export async function canAccessPatient(req: Request, patient: any): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'patient') {
    return patient.user_id?.toString() === req.user.sub;
  }
  if (req.user.role === 'doctor') {
    const doctor = await getCurrentDoctorProfile(req.user.sub);
    return doctor?._id?.toString() === patient.primary_doctor_id?.toString();
  }
  return false;
}

export async function getPatient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return;
  }

  const patient = await Patient.findById(id);
  if (!patient) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return;
  }

  if (!(await canAccessPatient(req, patient))) {
    res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
    return;
  }

  res.json(
    await mapPatient(patient, {
      is_self: patient.user_id?.toString() === req.user?.sub,
    }),
  );
}

export async function updateMyClinicalProfile(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const patient = await getCurrentPatientProfile(req.user.sub);
  if (!patient) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient profile not found' });
    return;
  }

  const updates = buildPatientUpdate(req.body as PatientProfilePayload);
  Object.assign(patient, updates);
  await patient.save();
  await syncPatientClinicalCollections(patient._id, updates);

  res.json(await mapPatient(patient, { is_self: true }));
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return;
  }

  const patient = await Patient.findById(id);
  if (!patient) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return;
  }

  if (!(await canAccessPatient(req, patient))) {
    res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
    return;
  }

  const updates = buildPatientUpdate(req.body as PatientProfilePayload);
  Object.assign(patient, updates);
  await patient.save();
  await syncPatientClinicalCollections(patient._id, updates);

  res.json(
    await mapPatient(patient, {
      is_self: patient.user_id?.toString() === req.user?.sub,
    }),
  );
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return;
  }

  await Patient.findByIdAndDelete(id);
  await DoctorAssignmentRequest.deleteMany({
    patient_id: new mongoose.Types.ObjectId(id),
  });
  res.status(StatusCodes.NO_CONTENT).send();
}
