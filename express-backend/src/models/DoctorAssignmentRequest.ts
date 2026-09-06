import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type DoctorAssignmentRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

export interface DoctorAssignmentRequestDocument extends Document {
  patient_id: mongoose.Types.ObjectId;
  doctor_id: mongoose.Types.ObjectId;
  requested_by_user_id: mongoose.Types.ObjectId;
  status: DoctorAssignmentRequestStatus;
  note?: string;
  responded_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const DoctorAssignmentRequestSchema =
  new Schema<DoctorAssignmentRequestDocument>(
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
        required: true,
        index: true,
      },
      requested_by_user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'cancelled'],
        default: 'pending',
        index: true,
      },
      note: { type: String },
      responded_at: { type: Date, default: null },
      created_at: { type: Date, default: () => new Date() },
      updated_at: { type: Date, default: () => new Date() },
    },
    {
      collection: 'doctor_assignment_requests',
    },
  );

DoctorAssignmentRequestSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

DoctorAssignmentRequestSchema.index(
  { patient_id: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
);

export const DoctorAssignmentRequest: Model<DoctorAssignmentRequestDocument> =
  mongoose.models.DoctorAssignmentRequest ||
  mongoose.model<DoctorAssignmentRequestDocument>(
    'DoctorAssignmentRequest',
    DoctorAssignmentRequestSchema,
  );
