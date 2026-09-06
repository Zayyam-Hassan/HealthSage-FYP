/**
 * Extends app.json so EAS can inject EXPO_PUBLIC_* at build time and config plugins
 * can apply native Android settings such as cleartext HTTP access on LAN.
 *
 * When EXPO_PUBLIC_* is unset (e.g. local `expo start` without .env), we default to
 * deployed backends so the app does not fall back to localhost + LAN discovery.
 * Override with frontend/.env or EXPO_PUBLIC_* for local Express/FastAPI on your LAN.
 */
const DEPLOYED_EXPRESS_API = 'https://health-sage-fyp.vercel.app/api/v1';
const DEPLOYED_FASTAPI_API = 'http://13.63.229.105/api/v1';

module.exports = ({ config }) => ({
  ...config,
  // iOS blocks http:// by default (ATS). FastAPI is http on a public IP — must allow cleartext.
  ios: {
    ...(config.ios ?? {}),
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  extra: {
    ...config.extra,
    expressApiUrl: process.env.EXPO_PUBLIC_EXPRESS_API_URL || DEPLOYED_EXPRESS_API,
    fastApiUrl: process.env.EXPO_PUBLIC_FASTAPI_API_URL || DEPLOYED_FASTAPI_API,
  },
});
