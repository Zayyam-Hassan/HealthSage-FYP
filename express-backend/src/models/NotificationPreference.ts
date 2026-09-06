import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface NotificationPreferenceDocument extends Document {
  user_id: mongoose.Types.ObjectId;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

const NotificationPreferenceSchema = new Schema<NotificationPreferenceDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    push_enabled: { type: Boolean, default: true },
    email_enabled: { type: Boolean, default: true },
    sms_enabled: { type: Boolean, default: false },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'notification_preferences',
  },
);

NotificationPreferenceSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const NotificationPreference: Model<NotificationPreferenceDocument> =
  mongoose.models.NotificationPreference ||
  mongoose.model<NotificationPreferenceDocument>(
    'NotificationPreference',
    NotificationPreferenceSchema,
  );
