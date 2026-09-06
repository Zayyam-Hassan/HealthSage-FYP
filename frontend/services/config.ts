/**
 * API Configuration
 *
 * This project uses two backends:
 * - Express app backend on port 9000 for auth/app routes
 * - FastAPI backend on port 8000 for AI services
 *
 * When the base URL is localhost or a private LAN IP, we verify and rediscover
 * the backend on the phone's subnet. Public URLs (Vercel, cloud IP) skip discovery.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

const API_PREFIX = '/api/v1';
const EXPRESS_PORT = '9000';
const FASTAPI_PORT = '8000';
const DISCOVERED_HOST_KEY = '@healthsage_discovered_host';
const DISCOVERY_CONCURRENCY = 24;
const HEALTHCHECK_TIMEOUT_MS = 900;

type ParsedBaseUrl = {
  host: string;
  pathname: string;
  port: string;
  protocol: 'http:' | 'https:';
};

/** Fix bad env values like "https:10.0.2.2:9000/api/v1" (missing slashes after the scheme). */
export function normalizeApiBaseUrl(url: string): string {
  let u = url.trim();
  if (/^https?:/i.test(u) && !/^https?:\/\//i.test(u)) {
    u = u.replace(/^(https?)(:)(?!\/\/)/i, '$1://');
  }
  return u.replace(/\/+$/, '');
}

function normalizeHost(candidate?: string | null): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  const withoutProtocol = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^exp:\/\//i, '');
  const host = withoutProtocol.split('/')[0]?.split(':')[0]?.trim();
  return host || null;
}

/**
 * In dev, Metro's bundle URL points at the machine running the packager - same machine as Express.
 * Prefer this on a physical device so we do not fall back to 10.0.2.2 (emulator-only).
 */
function resolveMetroPackagerHost(): string | null {
  if (!__DEV__) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const getDevServer = require('react-native/Libraries/Core/Devtools/getDevServer').default as () => {
      url: string;
      bundleLoadedFromServer: boolean;
    };
    const { url, bundleLoadedFromServer } = getDevServer();
    if (!bundleLoadedFromServer) return null;
    const m = url.match(/^https?:\/\/([^/:]+)/);
    const host = m?.[1] ?? null;
    if (!host || host === 'localhost' || host === '127.0.0.1') return null;
    return host;
  } catch {
    return null;
  }
}

function resolveExpoDevHost(): string | null {
  const metroHost = resolveMetroPackagerHost();
  if (metroHost) return metroHost;

  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.platform?.hostUri,
    (Constants.manifest as { hostUri?: string; debuggerHost?: string } | null)?.hostUri,
    (Constants.manifest as { hostUri?: string; debuggerHost?: string } | null)?.debuggerHost,
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
    // 10.0.2.2 is the Android emulator alias for the host PC - it does not work on real phones.
    if (!Device.isDevice) {
      return `http://10.0.2.2:${port}${API_PREFIX}`;
    }
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[config] No LAN host resolved. Create frontend/.env with EXPO_PUBLIC_EXPRESS_API_URL=http://<YOUR_PC_LAN_IP>:9000/api/v1 (same Wi-Fi as the phone).'
      );
    }
    return `http://localhost:${port}${API_PREFIX}`;
  }

  return `http://localhost:${port}${API_PREFIX}`;
}

function readExtraUrl(key: 'expressApiUrl' | 'fastApiUrl'): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const v = extra?.[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

const DEFAULT_APP_API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_EXPRESS_API_URL && process.env.EXPO_PUBLIC_EXPRESS_API_URL.length > 0
    ? process.env.EXPO_PUBLIC_EXPRESS_API_URL
    : process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.length > 0
      ? process.env.EXPO_PUBLIC_API_URL
      : readExtraUrl('expressApiUrl') ?? getDevBaseUrl(EXPRESS_PORT)
);

const DEFAULT_FASTAPI_API_BASE_URL = normalizeApiBaseUrl(
  process.env.EXPO_PUBLIC_FASTAPI_API_URL && process.env.EXPO_PUBLIC_FASTAPI_API_URL.length > 0
    ? process.env.EXPO_PUBLIC_FASTAPI_API_URL
    : readExtraUrl('fastApiUrl') ?? getDevBaseUrl(FASTAPI_PORT)
);

let appApiBaseUrl = DEFAULT_APP_API_BASE_URL;
let fastApiBaseUrl = DEFAULT_FASTAPI_API_BASE_URL;
let configReady = false;
let configurePromise: Promise<void> | null = null;

function parseBaseUrl(url: string): ParsedBaseUrl | null {
  try {
    const parsed = new URL(normalizeApiBaseUrl(url));
    return {
      host: parsed.hostname,
      pathname: parsed.pathname.replace(/\/+$/, ''),
      port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
      protocol: parsed.protocol === 'https:' ? 'https:' : 'http:',
    };
  } catch {
    return null;
  }
}

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isPrivateIpv4(host: string): boolean {
  if (!isIpv4(host)) return false;
  const [a, b] = host.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function shouldAttemptLanDiscovery(url: string): boolean {
  if (Platform.OS === 'web') return false;
  const parsed = parseBaseUrl(url);
  if (!parsed) return false;
  return parsed.host === 'localhost' || parsed.host === '127.0.0.1' || isPrivateIpv4(parsed.host);
}

function buildUrlFromHost(templateUrl: string, host: string): string {
  const parsed = parseBaseUrl(templateUrl);
  if (!parsed) return normalizeApiBaseUrl(templateUrl);
  return `${parsed.protocol}//${host}:${parsed.port}${parsed.pathname}`;
}

function buildHealthcheckUrl(baseUrl: string): string {
  return `${normalizeApiBaseUrl(baseUrl)}/health`;
}

function setRuntimeUrls(host: string): void {
  appApiBaseUrl = buildUrlFromHost(DEFAULT_APP_API_BASE_URL, host);
  fastApiBaseUrl = buildUrlFromHost(DEFAULT_FASTAPI_API_BASE_URL, host);
}

function resetRuntimeUrls(): void {
  appApiBaseUrl = DEFAULT_APP_API_BASE_URL;
  fastApiBaseUrl = DEFAULT_FASTAPI_API_BASE_URL;
}

async function saveDiscoveredHost(host: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISCOVERED_HOST_KEY, host);
  } catch {
    // ignore storage failures
  }
}

async function readDiscoveredHost(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(DISCOVERED_HOST_KEY);
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

async function clearDiscoveredHost(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISCOVERED_HOST_KEY);
  } catch {
    // ignore storage failures
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function isReachableBaseUrl(baseUrl: string, timeoutMs = HEALTHCHECK_TIMEOUT_MS): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(buildHealthcheckUrl(baseUrl), timeoutMs);
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return payload?.status === 'ok';
  } catch {
    return false;
  }
}

function buildCandidateHosts(deviceIp: string, preferredHosts: string[]): string[] {
  const [a, b, c] = deviceIp.split('.');
  const prefix = `${a}.${b}.${c}`;
  const ownHost = deviceIp;
  const prioritized = preferredHosts.filter(
    (host) => isIpv4(host) && host !== ownHost && host.startsWith(`${prefix}.`),
  );
  const allHosts = Array.from({ length: 254 }, (_, index) => `${prefix}.${index + 1}`).filter(
    (host) => host !== ownHost,
  );
  return Array.from(new Set([...prioritized, ...allHosts]));
}

async function discoverHostOnSubnet(deviceIp: string, preferredHosts: string[]): Promise<string | null> {
  const candidates = buildCandidateHosts(deviceIp, preferredHosts);
  for (let start = 0; start < candidates.length; start += DISCOVERY_CONCURRENCY) {
    const batch = candidates.slice(start, start + DISCOVERY_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (host) => {
        const baseUrl = buildUrlFromHost(DEFAULT_APP_API_BASE_URL, host);
        return (await isReachableBaseUrl(baseUrl)) ? host : null;
      }),
    );
    const match = results.find((host): host is string => Boolean(host));
    if (match) return match;
  }
  return null;
}

async function tryConfiguredHostFirst(hosts: string[]): Promise<string | null> {
  for (const host of hosts) {
    if (!host) continue;
    const baseUrl = buildUrlFromHost(DEFAULT_APP_API_BASE_URL, host);
    if (await isReachableBaseUrl(baseUrl, 600)) {
      return host;
    }
  }
  return null;
}

async function discoverLanHost(): Promise<string | null> {
  if (!shouldAttemptLanDiscovery(DEFAULT_APP_API_BASE_URL)) return null;

  const [networkState, cachedHost, currentIp] = await Promise.all([
    Network.getNetworkStateAsync().catch(() => null),
    readDiscoveredHost(),
    Network.getIpAddressAsync().catch(() => null),
  ]);

  if (!networkState?.isConnected || !currentIp || !isIpv4(currentIp)) {
    return null;
  }

  const configuredHost = parseBaseUrl(DEFAULT_APP_API_BASE_URL)?.host ?? null;
  const currentHost = parseBaseUrl(appApiBaseUrl)?.host ?? null;
  const preferredHosts = Array.from(
    new Set([currentHost, cachedHost, configuredHost].filter((host): host is string => Boolean(host))),
  );

  const directMatch = await tryConfiguredHostFirst(preferredHosts);
  if (directMatch) return directMatch;

  return discoverHostOnSubnet(currentIp, preferredHosts);
}

function logResolvedApiUrls(): void {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log('[config] Express API base:', appApiBaseUrl);
  // eslint-disable-next-line no-console
  console.log('[config] FastAPI base:', fastApiBaseUrl);
}

async function configureRuntimeUrls(forceDiscovery: boolean): Promise<void> {
  if (!forceDiscovery && configReady) return;

  resetRuntimeUrls();

  if (!shouldAttemptLanDiscovery(DEFAULT_APP_API_BASE_URL)) {
    configReady = true;
    logResolvedApiUrls();
    return;
  }

  const discoveredHost = await discoverLanHost();
  if (discoveredHost) {
    setRuntimeUrls(discoveredHost);
    await saveDiscoveredHost(discoveredHost);
  } else {
    await clearDiscoveredHost();
  }
  configReady = true;
  logResolvedApiUrls();
}

async function runConfiguration(forceDiscovery: boolean): Promise<void> {
  if (!forceDiscovery && configReady) return;
  if (!configurePromise) {
    configurePromise = configureRuntimeUrls(forceDiscovery).finally(() => {
      configurePromise = null;
    });
  }
  await configurePromise;
}

export async function initializeApiConfig(): Promise<void> {
  await runConfiguration(false);
}

export async function refreshApiConfig(): Promise<void> {
  configReady = false;
  await runConfiguration(true);
}

/** True when the app will scan the LAN for Express (localhost/private IP only). */
export function usesLanBackendDiscovery(): boolean {
  return shouldAttemptLanDiscovery(DEFAULT_APP_API_BASE_URL);
}

export function getApiBaseUrl(): string {
  return appApiBaseUrl;
}

export function getFastApiBaseUrl(): string {
  return fastApiBaseUrl;
}

export const APP_API_BASE_URL = DEFAULT_APP_API_BASE_URL;
export const FASTAPI_API_BASE_URL = DEFAULT_FASTAPI_API_BASE_URL;
export const API_BASE_URL = DEFAULT_APP_API_BASE_URL;
