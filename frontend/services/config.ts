/**
 * API Configuration
 *
 * Thunder Client can hit `http://localhost:8000/api/v1`, but on simulators
 * and physical devices `localhost` refers to the device, not your PC.
 * This mapping ensures the mobile app talks to the FastAPI backend correctly.
 */
import { Platform } from 'react-native';

const DEV_BASE_URL =
  // Android emulator: special host alias to reach the machine
  Platform.OS === 'android'
    ? 'http://10.0.2.2:9000/api/v1'
    : // iOS simulator & web: localhost works
      'http://localhost:9000/api/v1';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.length > 0
    ? process.env.EXPO_PUBLIC_API_URL
    : DEV_BASE_URL;

