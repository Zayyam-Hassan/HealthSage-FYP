import { apiClient } from './api';

export type NotificationPriority = 'low' | 'normal' | 'high';

export interface AppNotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: string;
  href?: string;
  priority?: NotificationPriority;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
}

export interface NotificationListResponse {
  items: AppNotificationItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface NotificationDevicePayload {
  expo_push_token: string;
  platform?: 'android' | 'ios' | 'web' | 'unknown';
  device_name?: string;
  app_version?: string;
}

class NotificationsService {
  async list(params?: { page?: number; limit?: number }): Promise<NotificationListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<NotificationListResponse>(`/notifications${suffix}`);
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return apiClient.get<{ count: number }>('/notifications/unread-count');
  }

  async markRead(notificationId: string): Promise<AppNotificationItem> {
    return apiClient.patch<AppNotificationItem>(`/notifications/${notificationId}/read`, {});
  }

  async markAllRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all', {});
  }

  async getPreferences(): Promise<NotificationPreferences> {
    return apiClient.get<NotificationPreferences>('/notifications/preferences');
  }

  async updatePreferences(
    payload: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    return apiClient.put<NotificationPreferences>('/notifications/preferences', payload);
  }

  async registerDevice(payload: NotificationDevicePayload): Promise<void> {
    await apiClient.post('/notifications/devices', payload);
  }

  async unregisterDevice(expoPushToken: string): Promise<void> {
    await apiClient.delete<void>('/notifications/devices', {
      expo_push_token: expoPushToken,
    });
  }

  async sendTest(): Promise<AppNotificationItem> {
    return apiClient.post<AppNotificationItem>('/notifications/test', {});
  }
}

export const notificationsService = new NotificationsService();

// Adapter for the Notifications screen, which expects a simple named export.
export async function sendTestNotification(): Promise<AppNotificationItem> {
  return notificationsService.sendTest();
}
