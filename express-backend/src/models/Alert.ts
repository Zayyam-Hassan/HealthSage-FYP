import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface AlertDocument extends Document {
  patient_id?: mongoose.Types.ObjectId;
  severity: string;
  type: string;
  title: string;
  body?: string;
  acknowledged_at?: Date | null;
  acknowledged_by?: mongoose.Types.ObjectId | null;
  created_at: Date;
}

const AlertSchema = new Schema<AlertDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    severity: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String },
    acknowledged_at: { type: Date, default: null },
    acknowledged_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    created_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'alerts',
  },
);

export const Alert: Model<AlertDocument> =
  mongoose.models.Alert || mongoose.model<AlertDocument>('Alert', AlertSchema);

