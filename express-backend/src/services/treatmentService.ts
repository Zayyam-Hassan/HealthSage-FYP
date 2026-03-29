import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { Doctor, type DoctorDocument } from '../models/Doctor';
import {
  LifestylePlan,
  type LifestylePlanDocument,
  type LifestylePlanStatus,
} from '../models/LifestylePlan';
import { Patient, type PatientDocument } from '../models/Patient';
import {
  Prescription,
  type PrescriptionDocument,
  type PrescriptionMedicationStatus,
  type PrescriptionStatus,
} from '../models/Prescription';

export interface PrescriptionMedicationInput {
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions?: string;
  status?: PrescriptionMedicationStatus;
}

export interface PrescriptionInput {
  diagnosis_context?: string;
  general_note?: string;
  medications: PrescriptionMedicationInput[];
}

export interface LifestylePlanInput {
  diet_plan?: string;
  exercise_plan?: string;
  sleep_guidance?: string;
  stress_guidance?: string;
  monitoring_guidance?: string;
  follow_up_note?: string;
  general_note?: string;
}

export class TreatmentError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export interface PrescriptionMedicationResponse {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions: string | null;
  status: PrescriptionMedicationStatus;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionResponse {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  status: PrescriptionStatus;
  diagnosis_context: string | null;
  general_note: string | null;
  medications: PrescriptionMedicationResponse[];
  discontinued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LifestylePlanResponse {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  status: LifestylePlanStatus;
  diet_plan: string | null;
  exercise_plan: string | null;
  sleep_guidance: string | null;
  stress_guidance: string | null;
  monitoring_guidance: string | null;
  follow_up_note: string | null;
  general_note: string | null;
  discontinued_at: string | null;
  created_at: string;
  updated_at: string;
}

function toObjectId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function trimOrUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function ensureMeaningfulString(value: string | undefined, fieldName: string): string {
  const trimmed = trimOrUndefined(value);
  if (!trimmed) {
    throw new TreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `${fieldName} is required`,
    );
  }
  return trimmed;
}

function mapPrescriptionMedication(
  item: PrescriptionDocument['medications'][number],
): PrescriptionMedicationResponse {
  return {
    id: item._id.toString(),
    medication_name: item.medication_name,
    dosage: item.dosage,
    frequency: item.frequency,
    route: item.route,
    duration: item.duration,
    timing_instructions: item.timing_instructions,
    special_instructions: item.special_instructions ?? null,
    status: item.status,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}

function mapPrescription(
  prescription: PrescriptionDocument,
  doctorName: string | null,
  patientName: string | null,
): PrescriptionResponse {
  return {
    id: prescription.id,
    patient_id: prescription.patient_id.toString(),
    doctor_id: prescription.doctor_id.toString(),
    doctor_name: doctorName,
    patient_name: patientName,
    status: prescription.status,
    diagnosis_context: prescription.diagnosis_context ?? null,
    general_note: prescription.general_note ?? null,
    medications: prescription.medications.map(mapPrescriptionMedication),
    discontinued_at: prescription.discontinued_at
      ? prescription.discontinued_at.toISOString()
      : null,
    created_at: prescription.created_at.toISOString(),
    updated_at: prescription.updated_at.toISOString(),
  };
}

function mapLifestylePlan(
  plan: LifestylePlanDocument,
  doctorName: string | null,
  patientName: string | null,
): LifestylePlanResponse {
  return {
    id: plan.id,
    patient_id: plan.patient_id.toString(),
    doctor_id: plan.doctor_id.toString(),
    doctor_name: doctorName,
    patient_name: patientName,
    status: plan.status,
    diet_plan: plan.diet_plan ?? null,
    exercise_plan: plan.exercise_plan ?? null,
    sleep_guidance: plan.sleep_guidance ?? null,
    stress_guidance: plan.stress_guidance ?? null,
    monitoring_guidance: plan.monitoring_guidance ?? null,
    follow_up_note: plan.follow_up_note ?? null,
    general_note: plan.general_note ?? null,
    discontinued_at: plan.discontinued_at ? plan.discontinued_at.toISOString() : null,
    created_at: plan.created_at.toISOString(),
    updated_at: plan.updated_at.toISOString(),
  };
}

async function getDoctorByUserId(userId: string): Promise<DoctorDocument | null> {
  return Doctor.findOne({ user_id: toObjectId(userId) });
}

async function getPatientByUserId(userId: string): Promise<PatientDocument | null> {
  return Patient.findOne({ user_id: toObjectId(userId) });
}

async function requireDoctorForUser(userId: string): Promise<DoctorDocument> {
  const doctor = await getDoctorByUserId(userId);
  if (!doctor) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Doctor profile not found');
  }
  return doctor;
}

async function requirePatientForUser(userId: string): Promise<PatientDocument> {
  const patient = await getPatientByUserId(userId);
  if (!patient) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Patient profile not found');
  }
  return patient;
}

async function requireManagedPatient(
  userId: string,
  patientId: string,
): Promise<{ doctor: DoctorDocument; patient: PatientDocument }> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(patientId)) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Patient not found');
  }

  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Patient not found');
  }

  if (patient.primary_doctor_id?.toString() !== doctor.id) {
    throw new TreatmentError(
      StatusCodes.FORBIDDEN,
      'You can only manage treatment plans for your assigned patients',
    );
  }

  return { doctor, patient };
}

function normalizePrescriptionInput(input: PrescriptionInput) {
  const medications = Array.isArray(input.medications)
    ? input.medications.map((item) => ({
        medication_name: ensureMeaningfulString(
          item.medication_name,
          'medication_name',
        ),
        dosage: ensureMeaningfulString(item.dosage, 'dosage'),
        frequency: ensureMeaningfulString(item.frequency, 'frequency'),
        route: ensureMeaningfulString(item.route, 'route'),
        duration: ensureMeaningfulString(item.duration, 'duration'),
        timing_instructions: ensureMeaningfulString(
          item.timing_instructions,
          'timing_instructions',
        ),
        special_instructions: trimOrUndefined(item.special_instructions),
        status: item.status ?? 'active',
      }))
    : [];

  if (medications.length === 0) {
    throw new TreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'A prescription must include at least one medication item',
    );
  }

  return {
    diagnosis_context: trimOrUndefined(input.diagnosis_context),
    general_note: trimOrUndefined(input.general_note),
    medications,
  };
}

function normalizeLifestylePlanInput(input: LifestylePlanInput): LifestylePlanInput {
  const normalized = {
    diet_plan: trimOrUndefined(input.diet_plan),
    exercise_plan: trimOrUndefined(input.exercise_plan),
    sleep_guidance: trimOrUndefined(input.sleep_guidance),
    stress_guidance: trimOrUndefined(input.stress_guidance),
    monitoring_guidance: trimOrUndefined(input.monitoring_guidance),
    follow_up_note: trimOrUndefined(input.follow_up_note),
    general_note: trimOrUndefined(input.general_note),
  };

  if (!Object.values(normalized).some(Boolean)) {
    throw new TreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Lifestyle plan must include at least one guidance section',
    );
  }

  return normalized;
}

async function getDoctorAccessiblePrescription(
  userId: string,
  prescriptionId: string,
): Promise<{ doctor: DoctorDocument; patient: PatientDocument; prescription: PrescriptionDocument }> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(prescriptionId)) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Prescription not found');
  }

  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Prescription not found');
  }

  const patient = await Patient.findById(prescription.patient_id);
  if (!patient) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Patient not found');
  }

  if (
    prescription.doctor_id.toString() !== doctor.id ||
    patient.primary_doctor_id?.toString() !== doctor.id
  ) {
    throw new TreatmentError(StatusCodes.FORBIDDEN, 'Forbidden');
  }

  return { doctor, patient, prescription };
}

async function getDoctorAccessibleLifestylePlan(
  userId: string,
  planId: string,
): Promise<{ doctor: DoctorDocument; patient: PatientDocument; plan: LifestylePlanDocument }> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(planId)) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Lifestyle plan not found');
  }

  const plan = await LifestylePlan.findById(planId);
  if (!plan) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Lifestyle plan not found');
  }

  const patient = await Patient.findById(plan.patient_id);
  if (!patient) {
    throw new TreatmentError(StatusCodes.NOT_FOUND, 'Patient not found');
  }

  if (
    plan.doctor_id.toString() !== doctor.id ||
    patient.primary_doctor_id?.toString() !== doctor.id
  ) {
    throw new TreatmentError(StatusCodes.FORBIDDEN, 'Forbidden');
  }

  return { doctor, patient, plan };
}

export async function createPrescriptionForDoctorPatient(
  userId: string,
  patientId: string,
  input: PrescriptionInput,
): Promise<PrescriptionResponse> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const normalized = normalizePrescriptionInput(input);

  await Prescription.updateMany(
    { patient_id: patient._id, doctor_id: doctor._id, status: 'active' },
    {
      $set: {
        status: 'discontinued',
        discontinued_at: new Date(),
        updated_at: new Date(),
      },
    },
  );

  const prescription = await Prescription.create({
    patient_id: patient._id,
    doctor_id: doctor._id,
    status: 'active',
    diagnosis_context: normalized.diagnosis_context,
    general_note: normalized.general_note,
    medications: normalized.medications,
  });

  console.info(
    `[treatment] prescription created doctor=${doctor.id} patient=${patient.id} prescription=${prescription.id}`,
  );

  return mapPrescription(prescription, doctor.name, patient.full_name);
}

export async function listPrescriptionsForDoctorPatient(
  userId: string,
  patientId: string,
): Promise<{ items: PrescriptionResponse[] }> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const items = await Prescription.find({
    patient_id: patient._id,
    doctor_id: doctor._id,
  }).sort({ created_at: -1 });

  return {
    items: items.map((item) => mapPrescription(item, doctor.name, patient.full_name)),
  };
}

export async function getPrescriptionForDoctor(
  userId: string,
  prescriptionId: string,
): Promise<PrescriptionResponse> {
  const { doctor, patient, prescription } = await getDoctorAccessiblePrescription(
    userId,
    prescriptionId,
  );
  return mapPrescription(prescription, doctor.name, patient.full_name);
}

export async function updatePrescriptionForDoctor(
  userId: string,
  prescriptionId: string,
  input: PrescriptionInput,
): Promise<PrescriptionResponse> {
  const { doctor, patient, prescription } = await getDoctorAccessiblePrescription(
    userId,
    prescriptionId,
  );

  if (prescription.status !== 'active') {
    throw new TreatmentError(
      StatusCodes.CONFLICT,
      'Only active prescriptions can be updated',
    );
  }

  const normalized = normalizePrescriptionInput(input);
  prescription.diagnosis_context = normalized.diagnosis_context;
  prescription.general_note = normalized.general_note;
  prescription.medications = normalized.medications.map((item) => ({
    ...item,
    created_at: new Date(),
    updated_at: new Date(),
  })) as any;
  await prescription.save();

  console.info(
    `[treatment] prescription updated doctor=${doctor.id} patient=${patient.id} prescription=${prescription.id}`,
  );

  return mapPrescription(prescription, doctor.name, patient.full_name);
}

export async function discontinuePrescriptionForDoctor(
  userId: string,
  prescriptionId: string,
): Promise<PrescriptionResponse> {
  const { doctor, patient, prescription } = await getDoctorAccessiblePrescription(
    userId,
    prescriptionId,
  );

  if (prescription.status !== 'active') {
    throw new TreatmentError(
      StatusCodes.CONFLICT,
      'Only active prescriptions can be discontinued',
    );
  }

  prescription.status = 'discontinued';
  prescription.discontinued_at = new Date();
  prescription.medications = prescription.medications.map((item) => ({
    medication_name: item.medication_name,
    dosage: item.dosage,
    frequency: item.frequency,
    route: item.route,
    duration: item.duration,
    timing_instructions: item.timing_instructions,
    special_instructions: item.special_instructions,
    status: 'discontinued',
    created_at: item.created_at,
    updated_at: new Date(),
  })) as any;
  await prescription.save();

  console.info(
    `[treatment] prescription discontinued doctor=${doctor.id} patient=${patient.id} prescription=${prescription.id}`,
  );

  return mapPrescription(prescription, doctor.name, patient.full_name);
}

export async function createLifestylePlanForDoctorPatient(
  userId: string,
  patientId: string,
  input: LifestylePlanInput,
): Promise<LifestylePlanResponse> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const normalized = normalizeLifestylePlanInput(input);

  await LifestylePlan.updateMany(
    { patient_id: patient._id, doctor_id: doctor._id, status: 'active' },
    {
      $set: {
        status: 'discontinued',
        discontinued_at: new Date(),
        updated_at: new Date(),
      },
    },
  );

  const plan = await LifestylePlan.create({
    patient_id: patient._id,
    doctor_id: doctor._id,
    status: 'active',
    ...normalized,
  });

  console.info(
    `[treatment] lifestyle plan created doctor=${doctor.id} patient=${patient.id} plan=${plan.id}`,
  );

  return mapLifestylePlan(plan, doctor.name, patient.full_name);
}

export async function listLifestylePlansForDoctorPatient(
  userId: string,
  patientId: string,
): Promise<{ items: LifestylePlanResponse[] }> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const items = await LifestylePlan.find({
    patient_id: patient._id,
    doctor_id: doctor._id,
  }).sort({ created_at: -1 });

  return {
    items: items.map((item) => mapLifestylePlan(item, doctor.name, patient.full_name)),
  };
}

export async function getLifestylePlanForDoctor(
  userId: string,
  planId: string,
): Promise<LifestylePlanResponse> {
  const { doctor, patient, plan } = await getDoctorAccessibleLifestylePlan(
    userId,
    planId,
  );
  return mapLifestylePlan(plan, doctor.name, patient.full_name);
}

export async function updateLifestylePlanForDoctor(
  userId: string,
  planId: string,
  input: LifestylePlanInput,
): Promise<LifestylePlanResponse> {
  const { doctor, patient, plan } = await getDoctorAccessibleLifestylePlan(
    userId,
    planId,
  );

  if (plan.status !== 'active') {
    throw new TreatmentError(
      StatusCodes.CONFLICT,
      'Only active lifestyle plans can be updated',
    );
  }

  const normalized = normalizeLifestylePlanInput(input);
  plan.diet_plan = normalized.diet_plan;
  plan.exercise_plan = normalized.exercise_plan;
  plan.sleep_guidance = normalized.sleep_guidance;
  plan.stress_guidance = normalized.stress_guidance;
  plan.monitoring_guidance = normalized.monitoring_guidance;
  plan.follow_up_note = normalized.follow_up_note;
  plan.general_note = normalized.general_note;
  await plan.save();

  console.info(
    `[treatment] lifestyle plan updated doctor=${doctor.id} patient=${patient.id} plan=${plan.id}`,
  );

  return mapLifestylePlan(plan, doctor.name, patient.full_name);
}

export async function discontinueLifestylePlanForDoctor(
  userId: string,
  planId: string,
): Promise<LifestylePlanResponse> {
  const { doctor, patient, plan } = await getDoctorAccessibleLifestylePlan(
    userId,
    planId,
  );

  if (plan.status !== 'active') {
    throw new TreatmentError(
      StatusCodes.CONFLICT,
      'Only active lifestyle plans can be discontinued',
    );
  }

  plan.status = 'discontinued';
  plan.discontinued_at = new Date();
  await plan.save();

  console.info(
    `[treatment] lifestyle plan discontinued doctor=${doctor.id} patient=${patient.id} plan=${plan.id}`,
  );

  return mapLifestylePlan(plan, doctor.name, patient.full_name);
}

export async function listPatientPrescriptions(
  userId: string,
): Promise<{ items: PrescriptionResponse[] }> {
  const patient = await requirePatientForUser(userId);
  const items = await Prescription.find({ patient_id: patient._id }).sort({ created_at: -1 });
  const doctorIds = [...new Set(items.map((item) => item.doctor_id.toString()))];
  const doctors = await Doctor.find({ _id: { $in: doctorIds } });
  const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

  return {
    items: items.map((item) =>
      mapPrescription(
        item,
        doctorNames.get(item.doctor_id.toString()) ?? null,
        patient.full_name,
      ),
    ),
  };
}

export async function listPatientActivePrescriptions(
  userId: string,
): Promise<{ items: PrescriptionResponse[] }> {
  const patient = await requirePatientForUser(userId);
  const items = await Prescription.find({
    patient_id: patient._id,
    status: 'active',
  }).sort({ created_at: -1 });
  const doctorIds = [...new Set(items.map((item) => item.doctor_id.toString()))];
  const doctors = await Doctor.find({ _id: { $in: doctorIds } });
  const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

  return {
    items: items.map((item) =>
      mapPrescription(
        item,
        doctorNames.get(item.doctor_id.toString()) ?? null,
        patient.full_name,
      ),
    ),
  };
}

export async function listPatientLifestylePlans(
  userId: string,
): Promise<{ items: LifestylePlanResponse[] }> {
  const patient = await requirePatientForUser(userId);
  const items = await LifestylePlan.find({ patient_id: patient._id }).sort({
    created_at: -1,
  });
  const doctorIds = [...new Set(items.map((item) => item.doctor_id.toString()))];
  const doctors = await Doctor.find({ _id: { $in: doctorIds } });
  const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

  return {
    items: items.map((item) =>
      mapLifestylePlan(
        item,
        doctorNames.get(item.doctor_id.toString()) ?? null,
        patient.full_name,
      ),
    ),
  };
}

export async function listPatientActiveLifestylePlans(
  userId: string,
): Promise<{ items: LifestylePlanResponse[] }> {
  const patient = await requirePatientForUser(userId);
  const items = await LifestylePlan.find({
    patient_id: patient._id,
    status: 'active',
  }).sort({ created_at: -1 });
  const doctorIds = [...new Set(items.map((item) => item.doctor_id.toString()))];
  const doctors = await Doctor.find({ _id: { $in: doctorIds } });
  const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

  return {
    items: items.map((item) =>
      mapLifestylePlan(
        item,
        doctorNames.get(item.doctor_id.toString()) ?? null,
        patient.full_name,
      ),
    ),
  };
}

export async function getPatientTreatmentOverview(userId: string): Promise<{
  active_prescriptions: PrescriptionResponse[];
  active_lifestyle_plans: LifestylePlanResponse[];
  prescription_history: PrescriptionResponse[];
  lifestyle_history: LifestylePlanResponse[];
}> {
  const [activePrescriptions, activePlans, prescriptionHistory, lifestyleHistory] =
    await Promise.all([
      listPatientActivePrescriptions(userId),
      listPatientActiveLifestylePlans(userId),
      listPatientPrescriptions(userId),
      listPatientLifestylePlans(userId),
    ]);

  return {
    active_prescriptions: activePrescriptions.items,
    active_lifestyle_plans: activePlans.items,
    prescription_history: prescriptionHistory.items,
    lifestyle_history: lifestyleHistory.items,
  };
}
