import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ConditionDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  code: string;
  display_name?: string;
  status: string;
  created_at: Date;
  neo4j_synced_at?: Date | null;
}

const ConditionSchema = new Schema<ConditionDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    code: { type: String, required: true },
    display_name: { type: String },
    status: { type: String, required: true },
    created_at: { type: Date, default: () => new Date() },
    neo4j_synced_at: { type: Date, default: null },
  },
  {
    collection: 'conditions',
  },
);

export const Condition: Model<ConditionDocument> =
  mongoose.models.Condition || mongoose.model<ConditionDocument>('Condition', ConditionSchema);

