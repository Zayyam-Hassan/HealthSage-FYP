import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface RiskPredictionDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  model_name: string;
  probability: number;
  predicted_label: number;
  explanation?: Record<string, any> | null;
  created_at: Date;
}

const RiskPredictionSchema = new Schema<RiskPredictionDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    model_name: { type: String, required: true },
    probability: { type: Number, required: true },
    predicted_label: { type: Number, required: true },
    explanation: { type: Schema.Types.Mixed, default: null },
    created_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'risk_predictions',
  },
);

export const RiskPrediction: Model<RiskPredictionDocument> =
  mongoose.models.RiskPrediction ||
  mongoose.model<RiskPredictionDocument>('RiskPrediction', RiskPredictionSchema);

