import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const appointmentSlotStatuses = [
  'available',
  'booked',
  'blocked',
  'cancelled',
  'completed',
] as const;

export type AppointmentSlotStatus = (typeof appointmentSlotStatuses)[number];

export interface AppointmentSlotDocument extends Document {
  doctor_id: mongoose.Types.ObjectId;
  availability_id?: mongoose.Types.ObjectId | null;
  slot_date: string;
  start_datetime: Date;
  end_datetime: Date;
  status: AppointmentSlotStatus;
  created_at: Date;
  updated_at: Date;
}

const AppointmentSlotSchema = new Schema<AppointmentSlotDocument>(
  {
    doctor_id: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    availability_id: {
      type: Schema.Types.ObjectId,
      ref: 'DoctorAvailability',
      default: null,
      index: true,
    },
    slot_date: { type: String, required: true, index: true },
    start_datetime: { type: Date, required: true, index: true },
    end_datetime: { type: Date, required: true },
    status: {
      type: String,
      enum: appointmentSlotStatuses,
      default: 'available',
      index: true,
    },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'appointment_slots',
  },
);

AppointmentSlotSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

AppointmentSlotSchema.index({ doctor_id: 1, start_datetime: 1 }, { unique: true });

export const AppointmentSlot: Model<AppointmentSlotDocument> =
  mongoose.models.AppointmentSlot ||
  mongoose.model<AppointmentSlotDocument>('AppointmentSlot', AppointmentSlotSchema);
