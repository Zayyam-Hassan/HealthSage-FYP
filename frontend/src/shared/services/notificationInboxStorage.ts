import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNotificationItem } from '@/services/notifications';

const STORAGE_KEY = '@healthsage_notification_inbox_cache_v1';

export type CachedNotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

export function subscribeInbox(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeToCached(item: Partial<AppNotificationItem> | any): CachedNotificationItem {
  const createdAt =
    typeof item?.createdAt === 'string'
      ? item.createdAt
      : typeof item?.created_at === 'string'
        ? item.created_at
        : new Date().toISOString();

  return {
    id: String(item?.id ?? ''),
    title: String(item?.title ?? ''),
    message: String(item?.message ?? ''),
    createdAt,
    read: Boolean(item?.read ?? false),
  };
}

export async function loadCachedNotifications(): Promise<CachedNotificationItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => normalizeToCached(x)).filter((x) => x.id.length > 0);
  } catch {
    return [];
  }
}

export async function prependNotification(item: Partial<AppNotificationItem>): Promise<CachedNotificationItem[]> {
  const current = await loadCachedNotifications();
  const next = [normalizeToCached(item), ...current].slice(0, 120);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify();
  return next;
}

export async function markCachedNotificationRead(id: string): Promise<void> {
  const current = await loadCachedNotifications();
  const next = current.map((n) => (n.id === id ? { ...n, read: true } : n));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify();
}


