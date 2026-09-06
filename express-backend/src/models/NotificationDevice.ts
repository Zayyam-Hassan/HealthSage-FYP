import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const notificationDevicePlatforms = ['android', 'ios', 'web', 'unknown'] as const;

export type NotificationDevicePlatform = (typeof notificationDevicePlatforms)[number];

export interface NotificationDeviceDocument extends Document {
  user_id: mongoose.Types.ObjectId;
  expo_push_token: string;
  platform: NotificationDevicePlatform;
  device_name?: string | null;
  app_version?: string | null;
  last_registered_at: Date;
  created_at: Date;
  updated_at: Date;
}

const NotificationDeviceSchema = new Schema<NotificationDeviceDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expo_push_token: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      enum: notificationDevicePlatforms,
      default: 'unknown',
    },
    device_name: { type: String, default: null },
    app_version: { type: String, default: null },
    last_registered_at: { type: Date, default: () => new Date() },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'notification_devices',
  },
);

NotificationDeviceSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

NotificationDeviceSchema.index({ user_id: 1, updated_at: -1 });

export const NotificationDevice: Model<NotificationDeviceDocument> =
  mongoose.models.NotificationDevice ||
  mongoose.model<NotificationDeviceDocument>('NotificationDevice', NotificationDeviceSchema);
