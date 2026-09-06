import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const notificationPriorities = ['low', 'normal', 'high'] as const;

export type NotificationPriority = (typeof notificationPriorities)[number];

export interface NotificationDocument extends Document {
  recipient_user_id: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  href?: string | null;
  data?: Record<string, unknown> | null;
  priority: NotificationPriority;
  read_at?: Date | null;
  dismissed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    recipient_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    href: { type: String, default: null },
    data: { type: Schema.Types.Mixed, default: null },
    priority: {
      type: String,
      enum: notificationPriorities,
      default: 'normal',
      index: true,
    },
    read_at: { type: Date, default: null, index: true },
    dismissed_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date(), index: true },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'notifications',
  },
);

NotificationSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

NotificationSchema.index({ recipient_user_id: 1, created_at: -1 });
NotificationSchema.index({ recipient_user_id: 1, read_at: 1, created_at: -1 });

export const Notification: Model<NotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<NotificationDocument>('Notification', NotificationSchema);
