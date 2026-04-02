import { useCallback, useEffect, useState } from 'react';
import {
  loadCachedNotifications,
  subscribeInbox,
  type CachedNotificationItem,
} from '@/src/shared/services/notificationInboxStorage';

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const items: CachedNotificationItem[] = await loadCachedNotifications();
    setCount(items.filter((n) => !n.read).length);
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeInbox(() => {
      void refresh();
    });
  }, [refresh]);

  return { count, refresh };
}

