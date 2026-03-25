import mongoose, { Schema, type Document, type Model } from 'mongoose';

interface PatientLabTests {
  hba1c?: number;
  fasting_glucose?: number;
  glucose?: number;
  cholesterol?: number;
  hdl?: number;
  ldl?: number;
  triglycerides?: number;
  urea?: number;
  creatinine?: number;
}

interface PatientVitalSigns {
  bmi?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
}

interface PatientLifestyle {
  smoking?: string;
  drinking?: string;
  exercise?: string;
}

export interface PatientDocument extends Document {
  user_id?: mongoose.Types.ObjectId | null;
  patient_id?: string;
  full_name: string;
  age?: number;
  sex?: string;
  height_cm?: number;
  weight_kg?: number;
  lab_tests?: PatientLabTests;
  vital_signs?: PatientVitalSigns;
  lifestyle?: PatientLifestyle;
  conditions: string[];
  primary_doctor_id?: mongoose.Types.ObjectId | null;
  primary_doctor_assigned_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  neo4j_synced_at?: Date | null;
}

const PatientSchema = new Schema<PatientDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
      default: null,
    },
    patient_id: { type: String, index: true },
    full_name: { type: String, required: true },
    age: { type: Number },
    sex: { type: String },
    height_cm: { type: Number },
    weight_kg: { type: Number },
    lab_tests: {
      hba1c: { type: Number },
      fasting_glucose: { type: Number },
      glucose: { type: Number },
      cholesterol: { type: Number },
      hdl: { type: Number },
      ldl: { type: Number },
      triglycerides: { type: Number },
      urea: { type: Number },
      creatinine: { type: Number },
    },
    vital_signs: {
      bmi: { type: Number },
      systolic_bp: { type: Number },
      diastolic_bp: { type: Number },
    },
    lifestyle: {
      smoking: { type: String },
      drinking: { type: String },
      exercise: { type: String },
    },
    conditions: [{ type: String }],
    primary_doctor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      index: true,
      default: null,
    },
    primary_doctor_assigned_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
    neo4j_synced_at: { type: Date, default: null },
  },
  {
    collection: 'patients',
  },
);

PatientSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

PatientSchema.index(
  { user_id: 1 },
  { unique: true, partialFilterExpression: { user_id: { $type: 'objectId' } } },
);

export const Patient: Model<PatientDocument> =
  mongoose.models.Patient || mongoose.model<PatientDocument>('Patient', PatientSchema);

