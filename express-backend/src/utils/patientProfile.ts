import mongoose from 'mongoose';
import { Condition } from '../models/Condition';
import { Observation } from '../models/Observation';
import type { DoctorDocument } from '../models/Doctor';
import type { DoctorAssignmentRequestDocument } from '../models/DoctorAssignmentRequest';
import type { PatientDocument } from '../models/Patient';

type NumericOrString = number | string | null | undefined;

export interface PatientProfilePayload {
  full_name?: string;
  age?: NumericOrString;
  sex?: string;
  gender?: string;
  height_cm?: NumericOrString;
  weight_kg?: NumericOrString;
  lab_tests?: {
    hba1c?: NumericOrString;
    fasting_glucose?: NumericOrString;
    glucose?: NumericOrString;
    cholesterol?: NumericOrString;
    hdl?: NumericOrString;
    ldl?: NumericOrString;
    triglycerides?: NumericOrString;
    urea?: NumericOrString;
    creatinine?: NumericOrString;
  };
  vital_signs?: {
    bmi?: NumericOrString;
    systolic_bp?: NumericOrString;
    diastolic_bp?: NumericOrString;
  };
  lifestyle?: {
    smoking?: string;
    drinking?: string;
    exercise?: string;
  };
  conditions?: string[];
}

type PatientPayloadOptions = {
  doctor?: DoctorDocument | null;
  pendingRequest?: DoctorAssignmentRequestDocument | null;
  is_self?: boolean;
};

const observationFieldSpecs = {
  hba1c: { code: 'HBA1C', unit: '%' },
  fasting_glucose: { code: 'FASTING_GLUCOSE', unit: 'mg/dL' },
  glucose: { code: 'RANDOM_GLUCOSE', unit: 'mg/dL' },
  cholesterol: { code: 'TOTAL_CHOLESTEROL', unit: 'mg/dL' },
  hdl: { code: 'HDL', unit: 'mg/dL' },
  ldl: { code: 'LDL', unit: 'mg/dL' },
  triglycerides: { code: 'TRIGLYCERIDES', unit: 'mg/dL' },
  urea: { code: 'UREA', unit: 'mg/dL' },
  creatinine: { code: 'CREATININE', unit: 'mg/dL' },
  bmi: { code: 'BMI', unit: 'kg/m2' },
  systolic_bp: { code: 'BLOOD_PRESSURE_SYSTOLIC', unit: 'mmHg' },
  diastolic_bp: { code: 'BLOOD_PRESSURE_DIASTOLIC', unit: 'mmHg' },
} as const;

function toNumber(value: NumericOrString): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeGender(value?: string | null): 'Male' | 'Female' | 'Other' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'male') return 'Male';
  if (normalized === 'female') return 'Female';
  return 'Other';
}

export function buildPatientUpdate(
  payload: PatientProfilePayload,
): Partial<PatientDocument> {
  const age = toNumber(payload.age);
  const height_cm = toNumber(payload.height_cm);
  const weight_kg = toNumber(payload.weight_kg);
  const lab_tests = payload.lab_tests ?? {};
  const vital_signs = payload.vital_signs ?? {};
  const sex = payload.sex ?? payload.gender;

  return {
    ...(payload.full_name ? { full_name: payload.full_name.trim() } : {}),
    ...(age !== undefined ? { age } : {}),
    ...(sex ? { sex: normalizeGender(sex) } : {}),
    ...(height_cm !== undefined ? { height_cm } : {}),
    ...(weight_kg !== undefined ? { weight_kg } : {}),
    lab_tests: {
      hba1c: toNumber(lab_tests.hba1c),
      fasting_glucose: toNumber(lab_tests.fasting_glucose),
      glucose: toNumber(lab_tests.glucose),
      cholesterol: toNumber(lab_tests.cholesterol),
      hdl: toNumber(lab_tests.hdl),
      ldl: toNumber(lab_tests.ldl),
      triglycerides: toNumber(lab_tests.triglycerides),
      urea: toNumber(lab_tests.urea),
      creatinine: toNumber(lab_tests.creatinine),
    },
    vital_signs: {
      bmi: toNumber(vital_signs.bmi),
      systolic_bp: toNumber(vital_signs.systolic_bp),
      diastolic_bp: toNumber(vital_signs.diastolic_bp),
    },
    lifestyle: {
      smoking: payload.lifestyle?.smoking?.trim() || undefined,
      drinking: payload.lifestyle?.drinking?.trim() || undefined,
      exercise: payload.lifestyle?.exercise?.trim() || undefined,
    },
    conditions: Array.isArray(payload.conditions)
      ? payload.conditions
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  } as Partial<PatientDocument>;
}

export async function syncPatientClinicalCollections(
  patientId: mongoose.Types.ObjectId,
  payload: Partial<PatientDocument>,
): Promise<void> {
  const ops: Promise<unknown>[] = [];

  const numericValues: Record<string, number | undefined> = {
    hba1c: payload.lab_tests?.hba1c,
    fasting_glucose: payload.lab_tests?.fasting_glucose,
    glucose: payload.lab_tests?.glucose,
    cholesterol: payload.lab_tests?.cholesterol,
    hdl: payload.lab_tests?.hdl,
    ldl: payload.lab_tests?.ldl,
    triglycerides: payload.lab_tests?.triglycerides,
    urea: payload.lab_tests?.urea,
    creatinine: payload.lab_tests?.creatinine,
    bmi: payload.vital_signs?.bmi,
    systolic_bp: payload.vital_signs?.systolic_bp,
    diastolic_bp: payload.vital_signs?.diastolic_bp,
  };

  // observations is a time-series log: append a new reading when the value
  // changes so charts can show progression, but skip no-op profile saves that
  // would otherwise flood the series with identical same-day points.
  const appendOps = Object.entries(observationFieldSpecs).map(
    async ([field, spec]) => {
      const value = numericValues[field];
      if (value === undefined) {
        return;
      }
      const latest = await Observation.findOne({
        patient_id: patientId,
        observation_code: spec.code,
      }).sort({ effective_at: -1, created_at: -1 });

      if (latest && latest.value_numeric === value) {
        return;
      }

      await Observation.create({
        patient_id: patientId,
        observation_code: spec.code,
        value_numeric: value,
        unit: spec.unit,
        effective_at: new Date(),
      });
    },
  );
  ops.push(...appendOps);

  ops.push(Condition.deleteMany({ patient_id: patientId }));
  const conditions = payload.conditions ?? [];
  if (conditions.length > 0) {
    ops.push(
      Condition.insertMany(
        conditions.map((condition) => ({
          patient_id: patientId,
          code: condition.toUpperCase().replace(/\s+/g, '_'),
          display_name: condition,
          status: 'active',
        })),
      ),
    );
  }

  await Promise.all(ops);
}

export function buildPatientPayload(
  patient: PatientDocument,
  options: PatientPayloadOptions = {},
) {
  const gender = normalizeGender(patient.sex);
  const doctor = options.doctor
    ? {
        id: options.doctor.id,
        doctor_id: options.doctor.doctor_id ?? options.doctor.id,
        name: options.doctor.name,
        specialization: options.doctor.specialization,
        email: options.doctor.email,
        phone: options.doctor.phone,
      }
    : null;

  return {
    id: patient.id,
    patient_id: patient.patient_id ?? patient.id,
    full_name: patient.full_name,
    demographics: {
      age: patient.age ?? 0,
      gender,
    },
    age: patient.age ?? 0,
    sex: gender,
    gender,
    height_cm: patient.height_cm,
    weight_kg: patient.weight_kg,
    lab_tests: {
      hba1c: patient.lab_tests?.hba1c,
      fasting_glucose: patient.lab_tests?.fasting_glucose,
      glucose: patient.lab_tests?.glucose,
      cholesterol: patient.lab_tests?.cholesterol,
      hdl: patient.lab_tests?.hdl,
      ldl: patient.lab_tests?.ldl,
      triglycerides: patient.lab_tests?.triglycerides,
      urea: patient.lab_tests?.urea,
      creatinine: patient.lab_tests?.creatinine,
    },
    vital_signs: {
      bmi: patient.vital_signs?.bmi,
      systolic_bp: patient.vital_signs?.systolic_bp,
      diastolic_bp: patient.vital_signs?.diastolic_bp,
      height_cm: patient.height_cm,
      weight_kg: patient.weight_kg,
    },
    lifestyle: {
      smoking: patient.lifestyle?.smoking,
      drinking: patient.lifestyle?.drinking,
      exercise: patient.lifestyle?.exercise,
    },
    conditions: patient.conditions ?? [],
    assignment: {
      status: doctor ? 'assigned' : options.pendingRequest ? 'pending' : 'unassigned',
      doctor,
      pending_request: options.pendingRequest
        ? {
            id: options.pendingRequest.id,
            doctor_id: options.pendingRequest.doctor_id.toString(),
            status: options.pendingRequest.status,
            created_at: options.pendingRequest.created_at.toISOString(),
          }
        : null,
    },
    is_self: options.is_self ?? false,
    created_at: patient.created_at.toISOString(),
    updated_at: patient.updated_at.toISOString(),
  };
}
