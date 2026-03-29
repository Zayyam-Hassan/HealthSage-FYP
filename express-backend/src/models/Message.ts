import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface MessageDocument extends Document {
  conversation_id: mongoose.Types.ObjectId;
  sender_type: string;
  sender_user_id?: mongoose.Types.ObjectId;
  body: string;
  attachment_ids?: mongoose.Types.ObjectId[];
  created_at: Date;
}

const MessageSchema = new Schema<MessageDocument>(
  {
    conversation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender_type: { type: String, required: true },
    sender_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    body: { type: String, required: true },
    attachment_ids: [{ type: Schema.Types.ObjectId, ref: 'Blob' }],
    created_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'messages',
  },
);

export const Message: Model<MessageDocument> =
  mongoose.models.Message || mongoose.model<MessageDocument>('Message', MessageSchema);

