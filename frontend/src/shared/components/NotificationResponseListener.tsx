import { useEffect } from 'react';
import { Platform } from 'react-native';
import { notificationsService } from '@/services/notifications';
import { emitNotificationStateChanged } from '@/src/shared/services/notificationEvents';

export function NotificationResponseListener() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    let responseSubscription: { remove: () => void } | undefined;
    let receiveSubscription: { remove: () => void } | undefined;

    void (async () => {
      const Notifications = await import('expo-notifications');
      if (cancelled) return;

      const handleResponse = (response: any) => {
        const data = response?.notification?.request?.content?.data as
          | { id?: unknown; href?: unknown }
          | undefined;

        // For backend pushes, we set `data: { id, type, href }`.
        const cachedId =
          (typeof data?.id === 'string' && data.id) ||
          (typeof response?.notification?.request?.identifier === 'string'
            ? response.notification.request.identifier
            : null);

        if (typeof cachedId === 'string' && cachedId.length > 0) {
          void notificationsService.markRead(cachedId).catch(() => undefined);
        }

        emitNotificationStateChanged();

      };

      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) handleResponse(last);
      } catch {
        // ignore
      }

      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      receiveSubscription = Notifications.addNotificationReceivedListener(() => {
        emitNotificationStateChanged();
      });
    })();

    return () => {
      cancelled = true;
      responseSubscription?.remove?.();
      receiveSubscription?.remove?.();
    };
  }, []);

  return null;
}

