import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const scheduledAppointmentStatuses = [
  'booked',
  'cancelled',
  'completed',
  'no_show',
] as const;

export type ScheduledAppointmentStatus =
  (typeof scheduledAppointmentStatuses)[number];

export interface ScheduledAppointmentDocument extends Document {
  slot_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  patient_id: mongoose.Types.ObjectId;
  status: ScheduledAppointmentStatus;
  reason_for_visit?: string;
  patient_note?: string;
  doctor_note?: string;
  booked_at: Date;
  cancelled_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const ScheduledAppointmentSchema = new Schema<ScheduledAppointmentDocument>(
  {
    slot_id: {
      type: Schema.Types.ObjectId,
      ref: 'AppointmentSlot',
      required: true,
      unique: true,
      index: true,
    },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    status: {
      type: String,
      enum: scheduledAppointmentStatuses,
      default: 'booked',
      index: true,
    },
    reason_for_visit: { type: String, default: '' },
    patient_note: { type: String },
    doctor_note: { type: String },
    booked_at: { type: Date, default: () => new Date() },
    cancelled_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'scheduled_appointments',
  },
);

ScheduledAppointmentSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const ScheduledAppointment: Model<ScheduledAppointmentDocument> =
  mongoose.models.ScheduledAppointment ||
  mongoose.model<ScheduledAppointmentDocument>(
    'ScheduledAppointment',
    ScheduledAppointmentSchema,
  );
