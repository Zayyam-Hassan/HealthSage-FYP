import mongoose from 'mongoose';
import type { JwtPayload } from '../utils/jwt';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import {
  callWhatIfBaseline,
  callWhatIfCompare,
} from '../integrations/fastapi/client';

type WhatIfComparePayload = {
  scenario_name?: string;
  modifications: Record<string, unknown>;
};

async function getAuthorizedPatient(user: JwtPayload | undefined, patientId: string) {
  if (!user || !mongoose.isValidObjectId(patientId)) {
    return null;
  }

  const patient = await Patient.findById(patientId).lean();
  if (!patient) {
    return null;
  }

  if (user.role === 'admin') {
    return patient;
  }

  if (user.role !== 'doctor') {
    return null;
  }

  const doctor = await Doctor.findOne({
    user_id: new mongoose.Types.ObjectId(user.sub),
  }).lean();

  if (!doctor) {
    return null;
  }

  return patient.primary_doctor_id?.toString() === doctor._id.toString() ? patient : null;
}

export async function getWhatIfBaselineForDoctor(
  user: JwtPayload | undefined,
  patientId: string,
) {
  const patient = await getAuthorizedPatient(user, patientId);
  if (!patient) {
    return null;
  }

  const baseline = await callWhatIfBaseline(patientId);
  return {
    ...baseline,
    patient_name: patient.full_name,
  };
}

export async function compareWhatIfForDoctor(
  user: JwtPayload | undefined,
  patientId: string,
  payload: WhatIfComparePayload,
) {
  const patient = await getAuthorizedPatient(user, patientId);
  if (!patient) {
    return null;
  }

  const compareData = await callWhatIfCompare(patientId, payload);
  return {
    ...compareData,
    patient_name: patient.full_name,
  };
}
