import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationsService } from '@/services/notifications';

const STORED_EXPO_PUSH_TOKEN_KEY = '@healthsage_expo_push_token';

/**
 * Minimal adapter kept for compatibility with `services/auth.ts`.
 * This project uses local notification testing + cached inbox storage.
 */
export async function unregisterCurrentDevice(): Promise<void> {
  const token = await AsyncStorage.getItem(STORED_EXPO_PUSH_TOKEN_KEY);
  if (!token) return;

  await notificationsService.unregisterDevice(token).catch(() => undefined);
  await AsyncStorage.removeItem(STORED_EXPO_PUSH_TOKEN_KEY).catch(() => undefined);
}

