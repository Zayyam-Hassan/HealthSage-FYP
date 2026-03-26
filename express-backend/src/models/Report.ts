import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ReportDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  doctor_id?: mongoose.Types.ObjectId | null;
  created_by_user_id?: mongoose.Types.ObjectId | null;
  title: string;
  type: string;
  summary?: string;
  content: Record<string, any>;
  generated_at: Date;
  generated_by?: string;
  source_reference?: string;
  is_sent_to_patient: boolean;
  sent_to_patient_at?: Date | null;
  last_sent_at?: Date | null;
  send_count: number;
  attachment_url?: string;
  attachment_path?: string;
  created_at: Date;
  updated_at: Date;
}

const ReportSchema = new Schema<ReportDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
      index: true,
    },
    created_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    title: { type: String, required: true },
    type: { type: String, default: 'other' },
    summary: { type: String },
    content: { type: Schema.Types.Mixed, default: {} },
    generated_at: { type: Date, default: () => new Date() },
    generated_by: { type: String },
    source_reference: { type: String },
    is_sent_to_patient: { type: Boolean, default: false },
    sent_to_patient_at: { type: Date, default: null },
    last_sent_at: { type: Date, default: null },
    send_count: { type: Number, default: 0 },
    attachment_url: { type: String },
    attachment_path: { type: String },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'reports',
  },
);

ReportSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const Report: Model<ReportDocument> =
  mongoose.models.Report || mongoose.model<ReportDocument>('Report', ReportSchema);

