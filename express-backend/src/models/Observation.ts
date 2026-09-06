import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ObservationDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  observation_code: string;
  value_numeric?: number;
  value_text?: string;
  unit?: string;
  effective_at?: Date;
  created_at: Date;
  neo4j_synced_at?: Date | null;
}

const ObservationSchema = new Schema<ObservationDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    observation_code: { type: String, required: true },
    value_numeric: { type: Number },
    value_text: { type: String },
    unit: { type: String },
    effective_at: { type: Date },
    created_at: { type: Date, default: () => new Date() },
    neo4j_synced_at: { type: Date, default: null },
  },
  {
    collection: 'observations',
  },
);

export const Observation: Model<ObservationDocument> =
  mongoose.models.Observation ||
  mongoose.model<ObservationDocument>('Observation', ObservationSchema);

