import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const uploadedReportCategories = [
  'patient_sent',
  'doctor_sent',
  'system_generated',
] as const;

export type UploadedReportCategory = (typeof uploadedReportCategories)[number];
export type UploadedByRole = 'patient' | 'doctor';

export interface UploadedReportDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  doctor_id?: mongoose.Types.ObjectId | null;
  uploaded_by_user_id: mongoose.Types.ObjectId;
  uploaded_by_role: UploadedByRole;
  title: string;
  category: UploadedReportCategory;
  description?: string;
  blob_id: mongoose.Types.ObjectId;
  file_name: string;
  mime_type: string;
  file_size?: number;
  is_sent_to_patient?: boolean;
  sent_to_patient_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const UploadedReportSchema = new Schema<UploadedReportDocument>(
  {
    patient_id: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctor_id: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
      index: true,
    },
    uploaded_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    uploaded_by_role: {
      type: String,
      enum: ['patient', 'doctor'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: uploadedReportCategories,
      required: true,
      index: true,
    },
    description: { type: String, trim: true },
    blob_id: {
      type: Schema.Types.ObjectId,
      ref: 'Blob',
      required: true,
      index: true,
    },
    file_name: { type: String, required: true },
    mime_type: { type: String, required: true },
    file_size: { type: Number },
    is_sent_to_patient: { type: Boolean, default: false, index: true },
    sent_to_patient_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'uploaded_reports',
  },
);

UploadedReportSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

UploadedReportSchema.index({ patient_id: 1, created_at: -1 });

export const UploadedReport: Model<UploadedReportDocument> =
  mongoose.models.UploadedReport ||
  mongoose.model<UploadedReportDocument>('UploadedReport', UploadedReportSchema);
