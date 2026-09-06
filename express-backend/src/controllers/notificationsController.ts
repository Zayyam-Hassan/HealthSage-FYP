import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import {
  createNotification,
  getNotificationPreferencesForUser,
  getUnreadNotificationCountForUser,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  registerNotificationDeviceForUser,
  unregisterNotificationDeviceForUser,
  updateNotificationPreferencesForUser,
} from '../services/notificationsService';

const DeviceSchema = z.object({
  expo_push_token: z.string().min(1),
  platform: z.enum(['android', 'ios', 'web', 'unknown']).optional(),
  device_name: z.string().max(120).optional(),
  app_version: z.string().max(40).optional(),
});

const PreferenceSchema = z.object({
  push_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
});

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1) || 1;
  const limit = Number(req.query.limit ?? 25) || 25;
  res.json(await listNotificationsForUser(req.user!.sub, { page, limit }));
}

export async function getUnreadNotificationCount(
  req: Request,
  res: Response,
): Promise<void> {
  const count = await getUnreadNotificationCountForUser(req.user!.sub);
  res.json({ count });
}

export async function markNotificationRead(
  req: Request,
  res: Response,
): Promise<void> {
  const item = await markNotificationReadForUser(req.user!.sub, req.params.notificationId);
  if (!item) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Notification not found' });
    return;
  }
  res.json(item);
}

export async function markAllNotificationsRead(
  req: Request,
  res: Response,
): Promise<void> {
  await markAllNotificationsReadForUser(req.user!.sub);
  res.status(StatusCodes.NO_CONTENT).send();
}

export async function getNotificationPreferences(
  req: Request,
  res: Response,
): Promise<void> {
  res.json(await getNotificationPreferencesForUser(req.user!.sub));
}

export async function updateNotificationPreferences(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = PreferenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid notification preferences payload',
      detail: parsed.error.flatten(),
    });
    return;
  }

  res.json(await updateNotificationPreferencesForUser(req.user!.sub, parsed.data));
}

export async function registerNotificationDevice(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = DeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid notification device payload',
      detail: parsed.error.flatten(),
    });
    return;
  }

  res.status(StatusCodes.CREATED).json(
    await registerNotificationDeviceForUser(req.user!.sub, parsed.data),
  );
}

export async function unregisterNotificationDevice(
  req: Request,
  res: Response,
): Promise<void> {
  const token = typeof req.body?.expo_push_token === 'string' ? req.body.expo_push_token.trim() : '';
  if (!token) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'expo_push_token is required',
    });
    return;
  }

  await unregisterNotificationDeviceForUser(req.user!.sub, token);
  res.status(StatusCodes.NO_CONTENT).send();
}

export async function createTestNotification(
  req: Request,
  res: Response,
): Promise<void> {
  const item = await createNotification({
    recipientUserId: req.user!.sub,
    type: 'test',
    title: 'HealthSage test notification',
    message: 'Notifications are connected and this inbox is now synced with the backend.',
    href: '/notifications',
  });
  res.status(StatusCodes.CREATED).json(item);
}
