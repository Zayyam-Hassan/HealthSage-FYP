/**
 * Extends app.json so EAS can inject EXPO_PUBLIC_* at build time and config plugins
 * can apply native Android settings such as cleartext HTTP access on LAN.
 */
module.exports = ({ config }) => ({
  ...config,
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
    expressApiUrl: process.env.EXPO_PUBLIC_EXPRESS_API_URL ?? '',
    fastApiUrl: process.env.EXPO_PUBLIC_FASTAPI_API_URL ?? '',
  },
});
