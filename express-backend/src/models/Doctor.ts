import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface DoctorDocument extends Document {
  user_id?: mongoose.Types.ObjectId | null;
  doctor_id?: string;
  name: string;
  specialization: string;
  email?: string;
  phone?: string;
  bio?: string;
  accepting_patients: boolean;
  created_at: Date;
  updated_at: Date;
}

const DoctorSchema = new Schema<DoctorDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
      default: null,
    },
    doctor_id: { type: String, index: true },
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    bio: { type: String },
    accepting_patients: { type: Boolean, default: true },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'doctors',
  },
);

DoctorSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

DoctorSchema.index(
  { user_id: 1 },
  { unique: true, partialFilterExpression: { user_id: { $type: 'objectId' } } },
);

export const Doctor: Model<DoctorDocument> =
  mongoose.models.Doctor || mongoose.model<DoctorDocument>('Doctor', DoctorSchema);

