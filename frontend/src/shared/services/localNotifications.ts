import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  parseNotificationRuntimeEvent,
  shouldSuppressForegroundNotification,
} from '@/src/shared/services/notificationEvents';

type ExpoModule = typeof import('expo-notifications');

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const ANDROID_CHANNEL_ID = 'healthsage-default';

async function loadExpoNotifications(): Promise<ExpoModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    const mod = await import('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

export async function initializeLocalNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const runtimeEvent = parseNotificationRuntimeEvent({
        kind: 'received',
        data: notification.request.content.data,
        fallbackId:
          typeof notification.request.identifier === 'string'
            ? notification.request.identifier
            : null,
      });
      const shouldSuppress = shouldSuppressForegroundNotification(runtimeEvent);

      return {
        shouldShowBanner: !shouldSuppress,
        shouldShowList: !shouldSuppress,
        shouldPlaySound: !shouldSuppress,
        shouldSetBadge: false,
      };
    },
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'HealthSage',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E66A6A',
      sound: 'default',
    });
  }

  // Expo Go can show local notifications, but we still must ensure permissions.
  const Device = await import('expo-device');
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return;

  // In case permissions were not yet granted.
  await Notifications.requestPermissionsAsync();
}

export async function presentTestNotificationOnDevice(input: {
  title: string;
  body: string;
  notificationId: string;
}) {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;

  // scheduleNotificationAsync with `trigger: null` presents immediately.
  await Notifications.scheduleNotificationAsync({
    identifier: input.notificationId,
    content: {
      title: input.title,
      body: input.body,
      sound: true,
      data: { notificationId: input.notificationId },
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null as any,
  });
}

