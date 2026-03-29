import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ConversationDocument extends Document {
  patient_id?: mongoose.Types.ObjectId;
  subject?: string;
  created_at: Date;
  updated_at: Date;
}

const ConversationSchema = new Schema<ConversationDocument>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient' },
    subject: { type: String },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'conversations',
  },
);

ConversationSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const Conversation: Model<ConversationDocument> =
  mongoose.models.Conversation ||
  mongoose.model<ConversationDocument>('Conversation', ConversationSchema);

