import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface AppointmentDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  proposed_slots: Date[];
  scheduled_at?: Date | null;
  requested_by_role: 'patient' | 'doctor';
  status: string;
  reason: string;
  notes?: string;
  response_message?: string;
  created_at: Date;
  updated_at: Date;
}

const AppointmentSchema = new Schema<AppointmentDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor_id: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    proposed_slots: [{ type: Date, required: true }],
    scheduled_at: { type: Date, default: null },
    requested_by_role: {
      type: String,
      enum: ['patient', 'doctor'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    reason: { type: String, default: '' },
    notes: { type: String },
    response_message: { type: String },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'appointments',
  },
);

AppointmentSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const Appointment: Model<AppointmentDocument> =
  mongoose.models.Appointment ||
  mongoose.model<AppointmentDocument>('Appointment', AppointmentSchema);

