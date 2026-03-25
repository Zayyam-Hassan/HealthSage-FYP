/**
 * API Configuration
 *
 * This project uses two backends:
 * - Express app backend on port 9000 for auth/app routes
 * - FastAPI backend on port 8000 for AI services
 *
 * On a physical device, localhost points to the phone itself, not your machine.
 * We derive the Expo dev host when possible so Expo Go can talk to both services over LAN.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PREFIX = '/api/v1';
const EXPRESS_PORT = '9000';
const FASTAPI_PORT = '8000';

function normalizeHost(candidate?: string | null): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const host = withoutProtocol.split('/')[0]?.split(':')[0]?.trim();
  return host || null;
}

function resolveExpoDevHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.platform?.hostUri,
  ];

  for (const candidate of candidates) {
    const host = normalizeHost(candidate);
    if (host) return host;
  }
  return null;
}

function getDevBaseUrl(port: string): string {
  const expoHost = resolveExpoDevHost();
  if (expoHost) {
    return `http://${expoHost}:${port}${API_PREFIX}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${port}${API_PREFIX}`;
  }

  return `http://localhost:${port}${API_PREFIX}`;
}

export const APP_API_BASE_URL =
  process.env.EXPO_PUBLIC_EXPRESS_API_URL && process.env.EXPO_PUBLIC_EXPRESS_API_URL.length > 0
    ? process.env.EXPO_PUBLIC_EXPRESS_API_URL
    : process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.length > 0
      ? process.env.EXPO_PUBLIC_API_URL
      : getDevBaseUrl(EXPRESS_PORT);

export const FASTAPI_API_BASE_URL =
  process.env.EXPO_PUBLIC_FASTAPI_API_URL && process.env.EXPO_PUBLIC_FASTAPI_API_URL.length > 0
    ? process.env.EXPO_PUBLIC_FASTAPI_API_URL
    : getDevBaseUrl(FASTAPI_PORT);

export const API_BASE_URL = APP_API_BASE_URL;
