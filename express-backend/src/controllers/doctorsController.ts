import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { Doctor } from '../models/Doctor';
import {
  DoctorAssignmentRequest,
  type DoctorAssignmentRequestStatus,
} from '../models/DoctorAssignmentRequest';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import {
  createNotificationForDoctorProfile,
  createNotificationForPatientProfile,
} from '../services/notificationsService';
import { buildPatientPayload } from '../utils/patientProfile';

async function getDoctorByUser(userId: string) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  let doctor = await Doctor.findOne({ user_id: userObjectId });
  if (!doctor) {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }
    doctor = await Doctor.create({
      user_id: userObjectId,
      doctor_id: `DR-${userId.slice(-6).toUpperCase()}`,
      name: user.display_name,
      specialization: 'Diabetes Care',
      email: user.email,
      accepting_patients: true,
    });
  }
  return doctor;
}

async function getPatientByUser(userId: string) {
  return Patient.findOne({ user_id: new mongoose.Types.ObjectId(userId) });
}

async function getRelationshipMetaForPatient(userId: string) {
  const patient = await getPatientByUser(userId);
  if (!patient) {
    return { patient: null, pendingRequest: null };
  }

  const pendingRequest = await DoctorAssignmentRequest.findOne({
    patient_id: patient._id,
    status: 'pending',
  }).sort({ created_at: -1 });

  return { patient, pendingRequest };
}

function mapDoctor(doc: any, extra?: Record<string, unknown>) {
  return {
    id: doc.id,
    doctor_id: doc.doctor_id ?? doc.id,
    name: doc.name,
    specialization: doc.specialization,
    email: doc.email,
    phone: doc.phone,
    bio: doc.bio,
    accepting_patients: doc.accepting_patients ?? true,
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
    ...extra,
  };
}

export async function listDoctors(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1) || 1;
  const limit = Number(req.query.limit ?? 20) || 20;
  const search =
    typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { specialization: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total, relationship] = await Promise.all([
    Doctor.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Doctor.countDocuments(filter),
    req.user?.role === 'patient'
      ? getRelationshipMetaForPatient(req.user.sub)
      : Promise.resolve({ patient: null, pendingRequest: null }),
  ]);

  res.json({
    items: items.map((doctor) =>
      mapDoctor(doctor, {
        relationship: relationship.patient
          ? {
              is_selected:
                relationship.patient.primary_doctor_id?.toString() === doctor.id,
              has_pending_request:
                relationship.pendingRequest?.doctor_id?.toString() === doctor.id,
              patient_assignment_status: relationship.patient.primary_doctor_id
                ? 'assigned'
                : relationship.pendingRequest
                  ? 'pending'
                  : 'unassigned',
            }
          : undefined,
      }),
    ),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

export async function getDoctor(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const doctor = mongoose.isValidObjectId(id)
    ? await Doctor.findById(id)
    : await Doctor.findOne({ doctor_id: id });

  if (!doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Doctor not found' });
    return;
  }

  let relationship: Record<string, unknown> | undefined;
  if (req.user?.role === 'patient') {
    const { patient, pendingRequest } = await getRelationshipMetaForPatient(
      req.user.sub,
    );

    relationship = patient
      ? {
          is_selected: patient.primary_doctor_id?.toString() === doctor.id,
          has_pending_request:
            pendingRequest?.doctor_id?.toString() === doctor.id,
          patient_assignment_status: patient.primary_doctor_id
            ? 'assigned'
            : pendingRequest
              ? 'pending'
              : 'unassigned',
        }
      : undefined;
  }

  res.json(mapDoctor(doctor, relationship ? { relationship } : undefined));
}

export async function getDoctorMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const doctor = await getDoctorByUser(req.user.sub);
  if (!doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Doctor profile not found' });
    return;
  }

  const patientCount = await Patient.countDocuments({
    primary_doctor_id: doctor._id,
  });

  res.json(
    mapDoctor(doctor, {
      stats: {
        patient_count: patientCount,
      },
    }),
  );
}

export async function getMyPatients(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const doctor = await getDoctorByUser(req.user.sub);
  if (!doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Doctor profile not found' });
    return;
  }

  const patients = await Patient.find({ primary_doctor_id: doctor._id }).sort({
    updated_at: -1,
  });

  res.json({
    items: patients.map((patient) =>
      buildPatientPayload(patient, {
        doctor,
      }),
    ),
  });
}

export async function requestDoctorAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const { id } = req.params;
  const doctor = mongoose.isValidObjectId(id)
    ? await Doctor.findById(id)
    : await Doctor.findOne({ doctor_id: id });

  if (!doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Doctor not found' });
    return;
  }

  if (!doctor.accepting_patients) {
    res.status(StatusCodes.CONFLICT).json({
      message: 'This doctor is not accepting new patients right now',
    });
    return;
  }

  const patient = await getPatientByUser(req.user.sub);
  if (!patient) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient profile not found' });
    return;
  }

  if (patient.primary_doctor_id) {
    res.status(StatusCodes.CONFLICT).json({
      message: 'You already have an assigned doctor',
    });
    return;
  }

  const existing = await DoctorAssignmentRequest.findOne({
    patient_id: patient._id,
    status: 'pending',
  });

  if (existing) {
    res.status(StatusCodes.CONFLICT).json({
      message: 'A doctor assignment request is already pending',
    });
    return;
  }

  const request = await DoctorAssignmentRequest.create({
    patient_id: patient._id,
    doctor_id: doctor._id,
    requested_by_user_id: new mongoose.Types.ObjectId(req.user.sub),
    status: 'pending',
    note:
      typeof req.body?.note === 'string' ? req.body.note.trim() : undefined,
  });

  await createNotificationForDoctorProfile(doctor._id, {
    type: 'doctor_assignment_request',
    title: 'New patient assignment request',
    message: `${patient.full_name} requested to connect with you.`,
    href: '/patients',
    data: {
      patient_id: patient.id,
      doctor_id: doctor.id,
      request_id: request.id,
    },
  }).catch(() => null);

  res.status(StatusCodes.CREATED).json({
    id: request.id,
    status: request.status,
    doctor: mapDoctor(doctor),
    patient_id: patient.id,
    created_at: request.created_at.toISOString(),
  });
}

export async function getAssignmentRequests(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const doctor = await getDoctorByUser(req.user.sub);
  if (!doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Doctor profile not found' });
    return;
  }

  const requests = await DoctorAssignmentRequest.find({
    doctor_id: doctor._id,
    status: 'pending',
  }).sort({ created_at: -1 });

  const patients = await Patient.find({
    _id: { $in: requests.map((request) => request.patient_id) },
  });
  const patientMap = new Map(patients.map((patient) => [patient.id, patient]));

  res.json({
    items: requests.map((request) => ({
      id: request.id,
      status: request.status,
      note: request.note,
      created_at: request.created_at.toISOString(),
      patient: patientMap.has(request.patient_id.toString())
        ? buildPatientPayload(patientMap.get(request.patient_id.toString())!, {
            doctor,
          })
        : null,
    })),
  });
}

export async function respondToAssignmentRequest(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const doctor = await getDoctorByUser(req.user.sub);
  if (!doctor) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Doctor profile not found' });
    return;
  }

  const { requestId } = req.params;
  if (!mongoose.isValidObjectId(requestId)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Assignment request not found' });
    return;
  }

  const action = (req.body?.action ?? '').toString().toLowerCase();
  const nextStatus: DoctorAssignmentRequestStatus | null =
    action === 'accept'
      ? 'accepted'
      : action === 'reject'
        ? 'rejected'
        : null;

  if (!nextStatus) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'action must be accept or reject',
    });
    return;
  }

  const request = await DoctorAssignmentRequest.findById(requestId);
  if (!request || request.doctor_id.toString() !== doctor.id) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Assignment request not found' });
    return;
  }

  if (request.status !== 'pending') {
    res.status(StatusCodes.CONFLICT).json({
      message: 'This assignment request has already been handled',
    });
    return;
  }

  const patient = await Patient.findById(request.patient_id);
  if (!patient) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Patient not found' });
    return;
  }

  if (nextStatus === 'accepted' && patient.primary_doctor_id) {
    res.status(StatusCodes.CONFLICT).json({
      message: 'This patient already has an assigned doctor',
    });
    return;
  }

  request.status = nextStatus;
  request.responded_at = new Date();
  await request.save();

  if (nextStatus === 'accepted') {
    patient.primary_doctor_id = doctor._id;
    patient.primary_doctor_assigned_at = new Date();
    await patient.save();

    await DoctorAssignmentRequest.updateMany(
      {
        patient_id: patient._id,
        _id: { $ne: request._id },
        status: 'pending',
      },
      {
        $set: {
          status: 'cancelled',
          responded_at: new Date(),
        },
      },
    );
  }

  await createNotificationForPatientProfile(patient._id, {
    type: 'doctor_assignment_update',
    title:
      nextStatus === 'accepted'
        ? 'Doctor request accepted'
        : 'Doctor request declined',
    message:
      nextStatus === 'accepted'
        ? `${doctor.name} accepted your assignment request.`
        : `${doctor.name} declined your assignment request.`,
    href: '/patients',
    data: {
      patient_id: patient.id,
      doctor_id: doctor.id,
      request_id: request.id,
      status: nextStatus,
    },
  }).catch(() => null);

  res.json({
    id: request.id,
    status: request.status,
    patient: buildPatientPayload(patient, {
      doctor: nextStatus === 'accepted' ? doctor : undefined,
    }),
  });
}
