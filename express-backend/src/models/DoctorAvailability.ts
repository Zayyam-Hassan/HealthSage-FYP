import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const weekdayValues = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type Weekday = (typeof weekdayValues)[number];

export interface DoctorAvailabilityDocument extends Document {
  doctor_id: mongoose.Types.ObjectId;
  weekday: Weekday;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  break_start_time?: string | null;
  break_end_time?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const DoctorAvailabilitySchema = new Schema<DoctorAvailabilityDocument>(
  {
    doctor_id: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    weekday: {
      type: String,
      enum: weekdayValues,
      required: true,
      index: true,
    },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    slot_duration_minutes: { type: Number, required: true },
    break_start_time: { type: String, default: null },
    break_end_time: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'doctor_availabilities',
  },
);

DoctorAvailabilitySchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

DoctorAvailabilitySchema.index(
  { doctor_id: 1, weekday: 1, start_time: 1, end_time: 1 },
  { unique: true },
);

export const DoctorAvailability: Model<DoctorAvailabilityDocument> =
  mongoose.models.DoctorAvailability ||
  mongoose.model<DoctorAvailabilityDocument>(
    'DoctorAvailability',
    DoctorAvailabilitySchema,
  );
