import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const prescriptionStatuses = ['active', 'discontinued', 'completed'] as const;
export type PrescriptionStatus = (typeof prescriptionStatuses)[number];

export const prescriptionMedicationStatuses = ['active', 'discontinued'] as const;
export type PrescriptionMedicationStatus =
  (typeof prescriptionMedicationStatuses)[number];

export interface PrescriptionMedicationItem {
  _id: mongoose.Types.ObjectId;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions?: string;
  status: PrescriptionMedicationStatus;
  created_at: Date;
  updated_at: Date;
}

export interface PrescriptionDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  status: PrescriptionStatus;
  diagnosis_context?: string;
  general_note?: string;
  medications: PrescriptionMedicationItem[];
  discontinued_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const PrescriptionMedicationSchema = new Schema<PrescriptionMedicationItem>(
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
      enum: prescriptionMedicationStatuses,
      default: 'active',
    },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  { _id: true, id: true },
);

PrescriptionMedicationSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const PrescriptionSchema = new Schema<PrescriptionDocument>(
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
      enum: prescriptionStatuses,
      default: 'active',
      index: true,
    },
    diagnosis_context: { type: String, trim: true },
    general_note: { type: String, trim: true },
    medications: {
      type: [PrescriptionMedicationSchema],
      default: [],
    },
    discontinued_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'prescriptions',
  },
);

PrescriptionSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

PrescriptionSchema.index({ patient_id: 1, doctor_id: 1, status: 1, created_at: -1 });

export const Prescription: Model<PrescriptionDocument> =
  mongoose.models.Prescription ||
  mongoose.model<PrescriptionDocument>('Prescription', PrescriptionSchema);
