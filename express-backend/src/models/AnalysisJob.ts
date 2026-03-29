import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface AnalysisJobDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  job_type: string;
  status: string;
  created_at: Date;
  completed_at?: Date | null;
  error_message?: string | null;
}

const AnalysisJobSchema = new Schema<AnalysisJobDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    job_type: { type: String, required: true },
    status: { type: String, required: true },
    created_at: { type: Date, default: () => new Date() },
    completed_at: { type: Date, default: null },
    error_message: { type: String, default: null },
  },
  {
    collection: 'analysis_jobs',
  },
);

export const AnalysisJob: Model<AnalysisJobDocument> =
  mongoose.models.AnalysisJob ||
  mongoose.model<AnalysisJobDocument>('AnalysisJob', AnalysisJobSchema);

