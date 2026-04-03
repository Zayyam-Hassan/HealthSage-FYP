import { useCallback, useEffect, useState } from 'react';
import { notificationsService } from '@/services/notifications';
import { subscribeNotificationState } from '@/src/shared/services/notificationEvents';

const UNREAD_COUNT_REFRESH_MS = 15_000;

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await notificationsService.getUnreadCount();
      setCount(response.count ?? 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeNotificationState(() => {
      void refresh();
    });
    const intervalId = setInterval(() => {
      void refresh();
    }, UNREAD_COUNT_REFRESH_MS);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [refresh]);

  return { count, refresh };
}
