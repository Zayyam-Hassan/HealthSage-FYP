import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { notificationsService } from '@/services/notifications';
import {
  emitNotificationEvent,
  emitNotificationStateChanged,
  NOTIFICATION_ACTION_MARK_READ,
  parseNotificationRuntimeEvent,
  setNotificationCurrentPath,
} from '@/src/shared/services/notificationEvents';

const handledResponseKeys = new Set<string>();

export function NotificationResponseListener() {
  const pathname = usePathname();

  useEffect(() => {
    setNotificationCurrentPath(pathname);
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    let responseSubscription: { remove: () => void } | undefined;
    let receiveSubscription: { remove: () => void } | undefined;

    void (async () => {
      const Notifications = await import('expo-notifications');
      if (cancelled) return;

      const handleResponse = (response: any) => {
        const actionIdentifier =
          typeof response?.actionIdentifier === 'string'
            ? response.actionIdentifier
            : null;
        const runtimeEvent = parseNotificationRuntimeEvent({
          kind: 'response',
          data: response?.notification?.request?.content?.data,
          fallbackId:
            typeof response?.notification?.request?.identifier === 'string'
              ? response.notification.request.identifier
              : null,
        });
        const responseKey =
          runtimeEvent.notificationId ||
          (actionIdentifier
            ? `${actionIdentifier}:${response?.notification?.request?.identifier ?? ''}`
            : null);

        if (responseKey && handledResponseKeys.has(responseKey)) {
          return;
        }

        if (responseKey) {
          handledResponseKeys.add(responseKey);
        }

        if (runtimeEvent.notificationId) {
          void notificationsService.markRead(runtimeEvent.notificationId).catch(() => undefined);
        }

        if (actionIdentifier === NOTIFICATION_ACTION_MARK_READ) {
          emitNotificationStateChanged();
          return;
        }

        emitNotificationEvent(runtimeEvent);
      };

      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) handleResponse(last);
      } catch {
        // ignore
      }

      responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      receiveSubscription = Notifications.addNotificationReceivedListener((notification) => {
        emitNotificationEvent(
          parseNotificationRuntimeEvent({
            kind: 'received',
            data: notification.request.content.data,
            fallbackId:
              typeof notification.request.identifier === 'string'
                ? notification.request.identifier
                : null,
          }),
        );
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

