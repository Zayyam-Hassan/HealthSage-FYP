import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  items: '@healthsage_notifications',
  pushEnabled: '@healthsage_notifications_push_enabled',
} as const;

export type AppNotificationType = 'appointment' | 'report' | 'reminder' | 'general';

export interface AppNotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: AppNotificationType;
}

let initialized = false;
const isExpoGo = Constants.executionEnvironment === 'storeClient';

async function loadNotificationsModule() {
  if (Platform.OS === 'web') return null;
  const Notifications = await import('expo-notifications');
  return Notifications;
}

export async function initializeNotifications() {
  if (initialized || Platform.OS === 'web' || isExpoGo) return;
  initialized = true;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  await Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('healthsage-default', {
      name: 'HealthSage Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E66A6A',
      sound: 'default',
    });
  }

  const Device = await import('expo-device');
  if (!Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  // Intentionally skip remote push token fetch in-app for Expo Go compatibility.
}

export async function getPushEnabled() {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.pushEnabled);
  return raw === null ? true : raw === 'true';
}

export async function setPushEnabled(value: boolean) {
  await AsyncStorage.setItem(STORAGE_KEYS.pushEnabled, String(value));
}

export async function getStoredNotifications(): Promise<AppNotificationItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.items);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AppNotificationItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveNotifications(items: AppNotificationItem[]) {
  await AsyncStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
}

export async function addAppNotification(input: {
  title: string;
  message: string;
  type?: AppNotificationType;
  triggerPhoneNotification?: boolean;
}) {
  const item: AppNotificationItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title,
    message: input.message,
    createdAt: new Date().toISOString(),
    read: false,
    type: input.type ?? 'general',
  };
  const current = await getStoredNotifications();
  const next = [item, ...current].slice(0, 120);
  await saveNotifications(next);

  if (Platform.OS !== 'web' && (await getPushEnabled()) && input.triggerPhoneNotification !== false) {
    if (isExpoGo) return;
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.message,
        sound: true,
        data: { type: item.type, id: item.id },
      },
      trigger: null,
    }).catch(() => null);
  }
}

export async function markNotificationRead(id: string) {
  const current = await getStoredNotifications();
  await saveNotifications(current.map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export async function markAllNotificationsRead() {
  const current = await getStoredNotifications();
  await saveNotifications(current.map((n) => ({ ...n, read: true })));
}
