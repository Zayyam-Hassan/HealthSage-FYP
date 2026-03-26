import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const doctorTreatmentPlanStatuses = ['active', 'discontinued', 'completed'] as const;
export type DoctorTreatmentPlanStatus = (typeof doctorTreatmentPlanStatuses)[number];

export const doctorTreatmentMedicationStatuses = ['active', 'discontinued'] as const;
export type DoctorTreatmentMedicationStatus =
  (typeof doctorTreatmentMedicationStatuses)[number];

export interface DoctorTreatmentAssessment {
  diagnosis?: string;
  clinical_impression?: string;
  risk_assessment?: string;
  treatment_goal?: string;
  follow_up_note?: string;
  rationale?: string;
}

export interface DoctorTreatmentMedicationItem {
  _id: mongoose.Types.ObjectId;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions?: string;
  status: DoctorTreatmentMedicationStatus;
  created_at: Date;
  updated_at: Date;
}

export interface DoctorTreatmentLifestylePlan {
  diet_plan?: string;
  exercise_plan?: string;
  sleep_guidance?: string;
  stress_guidance?: string;
  monitoring_guidance?: string;
  general_lifestyle_note?: string;
}

export interface DoctorTreatmentPlanDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  status: DoctorTreatmentPlanStatus;
  assessment?: DoctorTreatmentAssessment;
  medications: DoctorTreatmentMedicationItem[];
  lifestyle_plan?: DoctorTreatmentLifestylePlan;
  doctor_note?: string;
  discontinued_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const DoctorTreatmentAssessmentSchema = new Schema<DoctorTreatmentAssessment>(
  {
    diagnosis: { type: String, trim: true },
    clinical_impression: { type: String, trim: true },
    risk_assessment: { type: String, trim: true },
    treatment_goal: { type: String, trim: true },
    follow_up_note: { type: String, trim: true },
    rationale: { type: String, trim: true },
  },
  { _id: false, id: false },
);

const DoctorTreatmentMedicationSchema = new Schema<DoctorTreatmentMedicationItem>(
  {
    medication_name: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    route: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    timing_instructions: { type: String, required: true, trim: true },
    special_instructions: { type: String, trim: true },
    status: {
      type: String,
      enum: doctorTreatmentMedicationStatuses,
      default: 'active',
    },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  { _id: true, id: true },
);

DoctorTreatmentMedicationSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const DoctorTreatmentLifestyleSchema = new Schema<DoctorTreatmentLifestylePlan>(
  {
    diet_plan: { type: String, trim: true },
    exercise_plan: { type: String, trim: true },
    sleep_guidance: { type: String, trim: true },
    stress_guidance: { type: String, trim: true },
    monitoring_guidance: { type: String, trim: true },
    general_lifestyle_note: { type: String, trim: true },
  },
  { _id: false, id: false },
);

const DoctorTreatmentPlanSchema = new Schema<DoctorTreatmentPlanDocument>(
  {
    patient_id: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: doctorTreatmentPlanStatuses,
      default: 'active',
      index: true,
    },
    assessment: {
      type: DoctorTreatmentAssessmentSchema,
      default: undefined,
    },
    medications: {
      type: [DoctorTreatmentMedicationSchema],
      default: [],
    },
    lifestyle_plan: {
      type: DoctorTreatmentLifestyleSchema,
      default: undefined,
    },
    doctor_note: { type: String, trim: true },
    discontinued_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'doctor_treatment_plans',
  },
);

DoctorTreatmentPlanSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

DoctorTreatmentPlanSchema.index({
  patient_id: 1,
  doctor_id: 1,
  status: 1,
  created_at: -1,
});

export const DoctorTreatmentPlan: Model<DoctorTreatmentPlanDocument> =
  mongoose.models.DoctorTreatmentPlan ||
  mongoose.model<DoctorTreatmentPlanDocument>(
    'DoctorTreatmentPlan',
    DoctorTreatmentPlanSchema,
  );
