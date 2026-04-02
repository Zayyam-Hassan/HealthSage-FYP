import axios from 'axios';
import mongoose from 'mongoose';
import { Notification, type NotificationDocument, type NotificationPriority } from '../models/Notification';
import {
  NotificationDevice,
  type NotificationDevicePlatform,
} from '../models/NotificationDevice';
import { NotificationPreference } from '../models/NotificationPreference';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import { User } from '../models/User';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface NotificationApiItem {
  id: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  data?: Record<string, unknown> | null;
  priority: NotificationPriority;
  read: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPreferencesResponse {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}

export interface NotificationDeviceInput {
  expo_push_token: string;
  platform?: NotificationDevicePlatform;
  device_name?: string;
  app_version?: string;
}

export interface CreateNotificationInput {
  recipientUserId: string | mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  href?: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  sendPush?: boolean;
}

export interface CreateProfileNotificationInput {
  type: string;
  title: string;
  message: string;
  href?: string;
  data?: Record<string, unknown>;
  priority?: NotificationPriority;
  sendPush?: boolean;
}

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
}

function mapNotification(doc: NotificationDocument): NotificationApiItem {
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    href: doc.href ?? undefined,
    data: (doc.data as Record<string, unknown> | null) ?? null,
    priority: doc.priority,
    read: Boolean(doc.read_at),
    createdAt: doc.created_at.toISOString(),
    readAt: doc.read_at?.toISOString() ?? null,
  };
}

async function getOrCreatePreferences(
  userId: string | mongoose.Types.ObjectId,
) {
  const userObjectId = toObjectId(userId);
  let preference = await NotificationPreference.findOne({ user_id: userObjectId });
  if (!preference) {
    preference = await NotificationPreference.create({ user_id: userObjectId });
  }
  return preference;
}

async function sendPushToUserDevices(
  userId: mongoose.Types.ObjectId,
  notification: NotificationDocument,
) {
  const [preference, devices] = await Promise.all([
    getOrCreatePreferences(userId),
    NotificationDevice.find({ user_id: userId }),
  ]);

  if (!preference.push_enabled || devices.length === 0) {
    return;
  }

  const messages = devices.map((device) => ({
    to: device.expo_push_token,
    title: notification.title,
    body: notification.message,
    sound: 'default',
    data: {
      id: notification.id,
      type: notification.type,
      href: notification.href ?? undefined,
    },
  }));

  try {
    await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  } catch (error) {
    console.error('[notifications] Expo push dispatch failed', error);
  }
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationApiItem> {
  const notification = await Notification.create({
    recipient_user_id: toObjectId(input.recipientUserId),
    type: input.type,
    title: input.title,
    message: input.message,
    href: input.href ?? null,
    data: input.data ?? null,
    priority: input.priority ?? 'normal',
  });

  if (input.sendPush !== false) {
    void sendPushToUserDevices(notification.recipient_user_id, notification);
  }

  return mapNotification(notification);
}

export async function createNotificationForDoctorProfile(
  doctorId: string | mongoose.Types.ObjectId | null | undefined,
  input: CreateProfileNotificationInput,
): Promise<NotificationApiItem | null> {
  if (!doctorId) return null;
  const doctor = await Doctor.findById(doctorId).select({ user_id: 1 });
  if (!doctor?.user_id) return null;
  return createNotification({
    recipientUserId: doctor.user_id,
    ...input,
  });
}

export async function createNotificationForPatientProfile(
  patientId: string | mongoose.Types.ObjectId | null | undefined,
  input: CreateProfileNotificationInput,
): Promise<NotificationApiItem | null> {
  if (!patientId) return null;
  const patient = await Patient.findById(patientId).select({ user_id: 1 });
  if (!patient?.user_id) return null;
  return createNotification({
    recipientUserId: patient.user_id,
    ...input,
  });
}

export async function createWelcomeNotificationForUser(userId: string) {
  const user = await User.findById(userId).select({ display_name: 1, role: 1 });
  if (!user) return null;
  return createNotification({
    recipientUserId: user._id,
    type: 'welcome',
    title: 'Welcome to HealthSage',
    message:
      user.role === 'doctor'
        ? `Hi ${user.display_name}, your clinical workspace is ready.`
        : `Hi ${user.display_name}, your care workspace is ready.`,
    href: '/',
    sendPush: false,
  });
}

export async function listNotificationsForUser(
  userId: string,
  options?: { page?: number; limit?: number },
) {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 25));
  const filter = { recipient_user_id: toObjectId(userId) };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return {
    items: items.map(mapNotification),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function getUnreadNotificationCountForUser(userId: string) {
  return Notification.countDocuments({
    recipient_user_id: toObjectId(userId),
    read_at: null,
  });
}

export async function markNotificationReadForUser(
  userId: string,
  notificationId: string,
) {
  if (!mongoose.isValidObjectId(notificationId)) {
    return null;
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: toObjectId(notificationId),
      recipient_user_id: toObjectId(userId),
    },
    {
      $set: {
        read_at: new Date(),
        updated_at: new Date(),
      },
    },
    { new: true },
  );

  return notification ? mapNotification(notification) : null;
}

export async function markAllNotificationsReadForUser(userId: string) {
  await Notification.updateMany(
    {
      recipient_user_id: toObjectId(userId),
      read_at: null,
    },
    {
      $set: {
        read_at: new Date(),
        updated_at: new Date(),
      },
    },
  );
}

export async function getNotificationPreferencesForUser(userId: string) {
  const preference = await getOrCreatePreferences(userId);
  return {
    push_enabled: preference.push_enabled,
    email_enabled: preference.email_enabled,
    sms_enabled: preference.sms_enabled,
  } satisfies NotificationPreferencesResponse;
}

export async function updateNotificationPreferencesForUser(
  userId: string,
  patch: Partial<NotificationPreferencesResponse>,
) {
  const preference = await getOrCreatePreferences(userId);
  if (patch.push_enabled !== undefined) preference.push_enabled = patch.push_enabled;
  if (patch.email_enabled !== undefined) preference.email_enabled = patch.email_enabled;
  if (patch.sms_enabled !== undefined) preference.sms_enabled = patch.sms_enabled;
  await preference.save();
  return {
    push_enabled: preference.push_enabled,
    email_enabled: preference.email_enabled,
    sms_enabled: preference.sms_enabled,
  } satisfies NotificationPreferencesResponse;
}

export async function registerNotificationDeviceForUser(
  userId: string,
  input: NotificationDeviceInput,
) {
  const expoPushToken = input.expo_push_token.trim();
  const device = await NotificationDevice.findOneAndUpdate(
    { expo_push_token: expoPushToken },
    {
      $set: {
        user_id: toObjectId(userId),
        expo_push_token: expoPushToken,
        platform: input.platform ?? 'unknown',
        device_name: input.device_name?.trim() || null,
        app_version: input.app_version?.trim() || null,
        last_registered_at: new Date(),
        updated_at: new Date(),
      },
      $setOnInsert: {
        created_at: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  return {
    id: device.id,
    expo_push_token: device.expo_push_token,
    platform: device.platform,
    device_name: device.device_name ?? null,
    app_version: device.app_version ?? null,
    last_registered_at: device.last_registered_at.toISOString(),
  };
}

export async function unregisterNotificationDeviceForUser(
  userId: string,
  expoPushToken: string,
) {
  await NotificationDevice.deleteOne({
    user_id: toObjectId(userId),
    expo_push_token: expoPushToken.trim(),
  });
}
