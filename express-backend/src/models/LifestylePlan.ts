import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const lifestylePlanStatuses = ['active', 'discontinued', 'completed'] as const;
export type LifestylePlanStatus = (typeof lifestylePlanStatuses)[number];

export interface LifestylePlanDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  status: LifestylePlanStatus;
  diet_plan?: string;
  exercise_plan?: string;
  sleep_guidance?: string;
  stress_guidance?: string;
  monitoring_guidance?: string;
  follow_up_note?: string;
  general_note?: string;
  discontinued_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const LifestylePlanSchema = new Schema<LifestylePlanDocument>(
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
      enum: lifestylePlanStatuses,
      default: 'active',
      index: true,
    },
    diet_plan: { type: String, trim: true },
    exercise_plan: { type: String, trim: true },
    sleep_guidance: { type: String, trim: true },
    stress_guidance: { type: String, trim: true },
    monitoring_guidance: { type: String, trim: true },
    follow_up_note: { type: String, trim: true },
    general_note: { type: String, trim: true },
    discontinued_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'lifestyle_plans',
  },
);

LifestylePlanSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

LifestylePlanSchema.index({ patient_id: 1, doctor_id: 1, status: 1, created_at: -1 });

export const LifestylePlan: Model<LifestylePlanDocument> =
  mongoose.models.LifestylePlan ||
  mongoose.model<LifestylePlanDocument>('LifestylePlan', LifestylePlanSchema);
