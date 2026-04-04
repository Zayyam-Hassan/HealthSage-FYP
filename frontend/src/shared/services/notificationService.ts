import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { notificationsService } from '@/services/notifications';

const STORED_EXPO_PUSH_TOKEN_KEY = '@healthsage_expo_push_token';

/**
 * Registers the current device for real Expo push notifications.
 */
export async function registerCurrentDevice(userId?: string | null): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  const Notifications = await import('expo-notifications').catch(() => null);
  if (!Notifications) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    return;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data?.trim();
  if (!expoPushToken) return;

  const storedSignature = await AsyncStorage.getItem(STORED_EXPO_PUSH_TOKEN_KEY);
  const nextSignature = `${userId ?? 'anonymous'}:${expoPushToken}`;
  if (storedSignature === nextSignature) {
    return;
  }

  await notificationsService.registerDevice({
    expo_push_token: expoPushToken,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
    device_name: Device.deviceName ?? Device.modelName ?? 'HealthSage device',
    app_version: Constants.expoConfig?.version,
  });
  await AsyncStorage.setItem(STORED_EXPO_PUSH_TOKEN_KEY, nextSignature);
}

export async function unregisterCurrentDevice(): Promise<void> {
  const signature = await AsyncStorage.getItem(STORED_EXPO_PUSH_TOKEN_KEY);
  if (!signature) return;
  const token = signature.includes(':')
    ? signature.slice(signature.indexOf(':') + 1)
    : signature;

  await notificationsService.unregisterDevice(token).catch(() => undefined);
  await AsyncStorage.removeItem(STORED_EXPO_PUSH_TOKEN_KEY).catch(() => undefined);
}
