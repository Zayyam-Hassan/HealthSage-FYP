import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { Doctor, type DoctorDocument } from '../models/Doctor';
import {
  DoctorTreatmentPlan,
  type DoctorTreatmentAssessment,
  type DoctorTreatmentLifestylePlan,
  type DoctorTreatmentMedicationItem,
  type DoctorTreatmentMedicationStatus,
  type DoctorTreatmentPlanDocument,
  type DoctorTreatmentPlanStatus,
} from '../models/DoctorTreatmentPlan';
import { Patient, type PatientDocument } from '../models/Patient';

export interface DoctorTreatmentMedicationInput {
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions?: string;
  status?: DoctorTreatmentMedicationStatus;
}

export interface DoctorTreatmentAssessmentInput {
  diagnosis?: string;
  clinical_impression?: string;
  risk_assessment?: string;
  treatment_goal?: string;
  follow_up_note?: string;
  rationale?: string;
}

export interface DoctorTreatmentLifestyleInput {
  diet_plan?: string;
  exercise_plan?: string;
  sleep_guidance?: string;
  stress_guidance?: string;
  monitoring_guidance?: string;
  general_lifestyle_note?: string;
}

export interface DoctorTreatmentPlanInput {
  assessment?: DoctorTreatmentAssessmentInput;
  medications?: DoctorTreatmentMedicationInput[];
  lifestyle_plan?: DoctorTreatmentLifestyleInput;
  doctor_note?: string;
}

export interface DoctorTreatmentMedicationResponse {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions: string | null;
  status: DoctorTreatmentMedicationStatus;
  created_at: string;
  updated_at: string;
}

export interface DoctorTreatmentAssessmentResponse {
  diagnosis: string | null;
  clinical_impression: string | null;
  risk_assessment: string | null;
  treatment_goal: string | null;
  follow_up_note: string | null;
  rationale: string | null;
}

export interface DoctorTreatmentLifestyleResponse {
  diet_plan: string | null;
  exercise_plan: string | null;
  sleep_guidance: string | null;
  stress_guidance: string | null;
  monitoring_guidance: string | null;
  general_lifestyle_note: string | null;
}

export interface DoctorTreatmentPlanResponse {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string | null;
  doctor_name: string | null;
  status: DoctorTreatmentPlanStatus;
  assessment: DoctorTreatmentAssessmentResponse;
  medications: DoctorTreatmentMedicationResponse[];
  lifestyle_plan: DoctorTreatmentLifestyleResponse;
  doctor_note: string | null;
  discontinued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorTreatmentSummaryResponse {
  item: DoctorTreatmentPlanResponse | null;
}

export class DoctorTreatmentError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
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
    throw new DoctorTreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `${fieldName} is required`,
    );
  }
  return trimmed;
}

function mapAssessment(
  assessment?: DoctorTreatmentAssessment | null,
): DoctorTreatmentAssessmentResponse {
  return {
    diagnosis: assessment?.diagnosis ?? null,
    clinical_impression: assessment?.clinical_impression ?? null,
    risk_assessment: assessment?.risk_assessment ?? null,
    treatment_goal: assessment?.treatment_goal ?? null,
    follow_up_note: assessment?.follow_up_note ?? null,
    rationale: assessment?.rationale ?? null,
  };
}

function mapLifestyle(
  lifestyle?: DoctorTreatmentLifestylePlan | null,
): DoctorTreatmentLifestyleResponse {
  return {
    diet_plan: lifestyle?.diet_plan ?? null,
    exercise_plan: lifestyle?.exercise_plan ?? null,
    sleep_guidance: lifestyle?.sleep_guidance ?? null,
    stress_guidance: lifestyle?.stress_guidance ?? null,
    monitoring_guidance: lifestyle?.monitoring_guidance ?? null,
    general_lifestyle_note: lifestyle?.general_lifestyle_note ?? null,
  };
}

function mapMedication(
  item: DoctorTreatmentMedicationItem,
): DoctorTreatmentMedicationResponse {
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

function mapDoctorTreatmentPlan(
  plan: DoctorTreatmentPlanDocument,
  doctorName: string | null,
  patientName: string | null,
): DoctorTreatmentPlanResponse {
  return {
    id: plan.id,
    patient_id: plan.patient_id.toString(),
    doctor_id: plan.doctor_id.toString(),
    patient_name: patientName,
    doctor_name: doctorName,
    status: plan.status,
    assessment: mapAssessment(plan.assessment),
    medications: plan.medications.map(mapMedication),
    lifestyle_plan: mapLifestyle(plan.lifestyle_plan),
    doctor_note: plan.doctor_note ?? null,
    discontinued_at: plan.discontinued_at ? plan.discontinued_at.toISOString() : null,
    created_at: plan.created_at.toISOString(),
    updated_at: plan.updated_at.toISOString(),
  };
}

function hasMeaningfulAssessment(
  assessment?: DoctorTreatmentAssessmentInput | null,
): boolean {
  if (!assessment) return false;
  return Boolean(
    trimOrUndefined(assessment.diagnosis) ||
      trimOrUndefined(assessment.clinical_impression) ||
      trimOrUndefined(assessment.risk_assessment) ||
      trimOrUndefined(assessment.treatment_goal) ||
      trimOrUndefined(assessment.follow_up_note) ||
      trimOrUndefined(assessment.rationale),
  );
}

function hasMeaningfulLifestyle(
  lifestyle?: DoctorTreatmentLifestyleInput | null,
): boolean {
  if (!lifestyle) return false;
  return Boolean(
    trimOrUndefined(lifestyle.diet_plan) ||
      trimOrUndefined(lifestyle.exercise_plan) ||
      trimOrUndefined(lifestyle.sleep_guidance) ||
      trimOrUndefined(lifestyle.stress_guidance) ||
      trimOrUndefined(lifestyle.monitoring_guidance) ||
      trimOrUndefined(lifestyle.general_lifestyle_note),
  );
}

function normalizeAssessment(
  assessment?: DoctorTreatmentAssessmentInput | null,
): DoctorTreatmentAssessment | undefined {
  if (!assessment) return undefined;
  const normalized = {
    diagnosis: trimOrUndefined(assessment.diagnosis),
    clinical_impression: trimOrUndefined(assessment.clinical_impression),
    risk_assessment: trimOrUndefined(assessment.risk_assessment),
    treatment_goal: trimOrUndefined(assessment.treatment_goal),
    follow_up_note: trimOrUndefined(assessment.follow_up_note),
    rationale: trimOrUndefined(assessment.rationale),
  };
  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

function normalizeLifestyle(
  lifestyle?: DoctorTreatmentLifestyleInput | null,
): DoctorTreatmentLifestylePlan | undefined {
  if (!lifestyle) return undefined;
  const normalized = {
    diet_plan: trimOrUndefined(lifestyle.diet_plan),
    exercise_plan: trimOrUndefined(lifestyle.exercise_plan),
    sleep_guidance: trimOrUndefined(lifestyle.sleep_guidance),
    stress_guidance: trimOrUndefined(lifestyle.stress_guidance),
    monitoring_guidance: trimOrUndefined(lifestyle.monitoring_guidance),
    general_lifestyle_note: trimOrUndefined(lifestyle.general_lifestyle_note),
  };
  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

function normalizeMedications(
  medications?: DoctorTreatmentMedicationInput[] | null,
): DoctorTreatmentMedicationInput[] {
  const normalized = Array.isArray(medications)
    ? medications
        .map((item) => ({
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
        .filter((item) => item.medication_name)
    : [];

  return normalized;
}

function normalizeDoctorTreatmentInput(
  input: DoctorTreatmentPlanInput,
): {
  assessment?: DoctorTreatmentAssessment;
  medications: DoctorTreatmentMedicationInput[];
  lifestyle_plan?: DoctorTreatmentLifestylePlan;
  doctor_note?: string;
} {
  const medications = normalizeMedications(input.medications);
  const assessment = normalizeAssessment(input.assessment);
  const lifestyle_plan = normalizeLifestyle(input.lifestyle_plan);
  const doctor_note = trimOrUndefined(input.doctor_note);

  if (!assessment && medications.length === 0 && !lifestyle_plan) {
    throw new DoctorTreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Treatment plan must include assessment, medications, or lifestyle guidance',
    );
  }

  return {
    assessment,
    medications,
    lifestyle_plan,
    doctor_note,
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
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Doctor profile not found');
  }
  return doctor;
}

async function requirePatientForUser(userId: string): Promise<PatientDocument> {
  const patient = await getPatientByUserId(userId);
  if (!patient) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Patient profile not found');
  }
  return patient;
}

async function requireManagedPatient(
  userId: string,
  patientId: string,
): Promise<{ doctor: DoctorDocument; patient: PatientDocument }> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(patientId)) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Patient not found');
  }

  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Patient not found');
  }

  if (patient.primary_doctor_id?.toString() !== doctor.id) {
    throw new DoctorTreatmentError(
      StatusCodes.FORBIDDEN,
      'You can only manage doctor treatment plans for your assigned patients',
    );
  }

  return { doctor, patient };
}

async function getDoctorAccessibleTreatmentPlan(
  userId: string,
  treatmentPlanId: string,
): Promise<{ doctor: DoctorDocument; patient: PatientDocument; plan: DoctorTreatmentPlanDocument }> {
  const doctor = await requireDoctorForUser(userId);

  if (!mongoose.isValidObjectId(treatmentPlanId)) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Treatment plan not found');
  }

  const plan = await DoctorTreatmentPlan.findById(treatmentPlanId);
  if (!plan) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Treatment plan not found');
  }

  const patient = await Patient.findById(plan.patient_id);
  if (!patient) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Patient not found');
  }

  if (
    plan.doctor_id.toString() !== doctor.id ||
    patient.primary_doctor_id?.toString() !== doctor.id
  ) {
    throw new DoctorTreatmentError(StatusCodes.FORBIDDEN, 'Forbidden');
  }

  return { doctor, patient, plan };
}

async function getPatientAccessibleTreatmentPlan(
  userId: string,
  treatmentPlanId: string,
): Promise<{ patient: PatientDocument; plan: DoctorTreatmentPlanDocument; doctor: DoctorDocument | null }> {
  const patient = await requirePatientForUser(userId);

  if (!mongoose.isValidObjectId(treatmentPlanId)) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Treatment plan not found');
  }

  const plan = await DoctorTreatmentPlan.findById(treatmentPlanId);
  if (!plan || plan.patient_id.toString() !== patient.id) {
    throw new DoctorTreatmentError(StatusCodes.NOT_FOUND, 'Treatment plan not found');
  }

  const doctor = await Doctor.findById(plan.doctor_id);
  return { patient, plan, doctor };
}

export async function createDoctorTreatmentPlanForPatient(
  userId: string,
  patientId: string,
  input: DoctorTreatmentPlanInput,
): Promise<DoctorTreatmentPlanResponse> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const normalized = normalizeDoctorTreatmentInput(input);

  await DoctorTreatmentPlan.updateMany(
    { patient_id: patient._id, doctor_id: doctor._id, status: 'active' },
    {
      $set: {
        status: 'discontinued',
        discontinued_at: new Date(),
        updated_at: new Date(),
      },
    },
  );

  const plan = await DoctorTreatmentPlan.create({
    patient_id: patient._id,
    doctor_id: doctor._id,
    status: 'active',
    assessment: normalized.assessment,
    medications: normalized.medications,
    lifestyle_plan: normalized.lifestyle_plan,
    doctor_note: normalized.doctor_note,
  });

  console.info(
    `[doctor-treatment] created doctor=${doctor.id} patient=${patient.id} plan=${plan.id}`,
  );

  return mapDoctorTreatmentPlan(plan, doctor.name, patient.full_name);
}

export async function listDoctorTreatmentPlansForPatient(
  userId: string,
  patientId: string,
): Promise<{ items: DoctorTreatmentPlanResponse[] }> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const items = await DoctorTreatmentPlan.find({
    patient_id: patient._id,
    doctor_id: doctor._id,
  }).sort({ created_at: -1 });

  return {
    items: items.map((item) => mapDoctorTreatmentPlan(item, doctor.name, patient.full_name)),
  };
}

export async function getDoctorTreatmentPlanForDoctor(
  userId: string,
  treatmentPlanId: string,
): Promise<DoctorTreatmentPlanResponse> {
  const { doctor, patient, plan } = await getDoctorAccessibleTreatmentPlan(
    userId,
    treatmentPlanId,
  );
  return mapDoctorTreatmentPlan(plan, doctor.name, patient.full_name);
}

export async function updateDoctorTreatmentPlanForDoctor(
  userId: string,
  treatmentPlanId: string,
  input: DoctorTreatmentPlanInput,
): Promise<DoctorTreatmentPlanResponse> {
  const { doctor, patient, plan } = await getDoctorAccessibleTreatmentPlan(
    userId,
    treatmentPlanId,
  );

  if (plan.status !== 'active') {
    throw new DoctorTreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Only active treatment plans can be updated',
    );
  }

  const normalized = normalizeDoctorTreatmentInput(input);

  plan.assessment = normalized.assessment;
  plan.medications = normalized.medications as any;
  plan.lifestyle_plan = normalized.lifestyle_plan;
  plan.doctor_note = normalized.doctor_note;
  plan.updated_at = new Date();
  await plan.save();

  console.info(
    `[doctor-treatment] updated doctor=${doctor.id} patient=${patient.id} plan=${plan.id}`,
  );

  return mapDoctorTreatmentPlan(plan, doctor.name, patient.full_name);
}

export async function discontinueDoctorTreatmentPlanForDoctor(
  userId: string,
  treatmentPlanId: string,
): Promise<DoctorTreatmentPlanResponse> {
  const { doctor, patient, plan } = await getDoctorAccessibleTreatmentPlan(
    userId,
    treatmentPlanId,
  );

  if (plan.status === 'discontinued') {
    throw new DoctorTreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Treatment plan is already discontinued',
    );
  }

  plan.status = 'discontinued';
  plan.discontinued_at = new Date();
  plan.updated_at = new Date();
  await plan.save();

  console.info(
    `[doctor-treatment] discontinued doctor=${doctor.id} patient=${patient.id} plan=${plan.id}`,
  );

  return mapDoctorTreatmentPlan(plan, doctor.name, patient.full_name);
}

export async function completeDoctorTreatmentPlanForDoctor(
  userId: string,
  treatmentPlanId: string,
): Promise<DoctorTreatmentPlanResponse> {
  const { doctor, patient, plan } = await getDoctorAccessibleTreatmentPlan(
    userId,
    treatmentPlanId,
  );

  if (plan.status === 'completed') {
    throw new DoctorTreatmentError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Treatment plan is already completed',
    );
  }

  plan.status = 'completed';
  plan.updated_at = new Date();
  await plan.save();

  console.info(
    `[doctor-treatment] completed doctor=${doctor.id} patient=${patient.id} plan=${plan.id}`,
  );

  return mapDoctorTreatmentPlan(plan, doctor.name, patient.full_name);
}

export async function getPatientActiveDoctorTreatmentPlan(
  userId: string,
): Promise<DoctorTreatmentSummaryResponse> {
  const patient = await requirePatientForUser(userId);
  const plan = await DoctorTreatmentPlan.findOne({
    patient_id: patient._id,
    status: 'active',
  }).sort({ updated_at: -1, created_at: -1 });

  if (!plan) {
    return { item: null };
  }

  const doctor = await Doctor.findById(plan.doctor_id);
  return {
    item: mapDoctorTreatmentPlan(plan, doctor?.name ?? null, patient.full_name),
  };
}

export async function listPatientDoctorTreatmentHistory(
  userId: string,
): Promise<{ items: DoctorTreatmentPlanResponse[] }> {
  const patient = await requirePatientForUser(userId);
  const items = await DoctorTreatmentPlan.find({
    patient_id: patient._id,
  }).sort({ created_at: -1 });
  const doctors = await Doctor.find({
    _id: { $in: items.map((item) => item.doctor_id) },
  }).select({ _id: 1, name: 1 });
  const doctorNameMap = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

  return {
    items: items.map((item) =>
      mapDoctorTreatmentPlan(item, doctorNameMap.get(item.doctor_id.toString()) ?? null, patient.full_name),
    ),
  };
}

export async function getDoctorTreatmentPlanForPatient(
  userId: string,
  treatmentPlanId: string,
): Promise<DoctorTreatmentPlanResponse> {
  const { patient, plan, doctor } = await getPatientAccessibleTreatmentPlan(
    userId,
    treatmentPlanId,
  );
  return mapDoctorTreatmentPlan(plan, doctor?.name ?? null, patient.full_name);
}

export async function getDoctorActiveTreatmentSummaryForDoctor(
  userId: string,
  patientId: string,
): Promise<DoctorTreatmentSummaryResponse> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const plan = await DoctorTreatmentPlan.findOne({
    patient_id: patient._id,
    doctor_id: doctor._id,
    status: 'active',
  }).sort({ updated_at: -1, created_at: -1 });

  return {
    item: plan ? mapDoctorTreatmentPlan(plan, doctor.name, patient.full_name) : null,
  };
}

export async function getLatestActiveDoctorTreatmentPlanByPatientId(
  patientId: string,
): Promise<DoctorTreatmentPlanResponse | null> {
  if (!mongoose.isValidObjectId(patientId)) {
    return null;
  }

  const [plan, patient] = await Promise.all([
    DoctorTreatmentPlan.findOne({
      patient_id: new mongoose.Types.ObjectId(patientId),
      status: 'active',
    }).sort({ updated_at: -1, created_at: -1 }),
    Patient.findById(patientId).select({ full_name: 1 }),
  ]);

  if (!plan) {
    return null;
  }

  const doctor = await Doctor.findById(plan.doctor_id).select({ name: 1 });
  return mapDoctorTreatmentPlan(plan, doctor?.name ?? null, patient?.full_name ?? null);
}
