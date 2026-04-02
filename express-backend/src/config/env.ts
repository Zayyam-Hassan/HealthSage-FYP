import dotenv from 'dotenv';

dotenv.config();

/**
 * Throws at process startup if a required env var is missing or blank.
 * Do not use localhost fallbacks for production-critical values.
 */
export function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const rawCors = process.env.CORS_ORIGIN ?? '*';
const corsOrigins =
  rawCors === '*'
    ? ['*']
    : rawCors
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /** Bind address so phones on the same LAN can reach the API (default all interfaces). */
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 9000),
  mongoUri: required('MONGO_URI'),
  mongoDbName: required('MONGO_DB_NAME'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  fastApiBaseUrl: required('FASTAPI_BASE_URL'),
  corsOrigins,
} as const;
