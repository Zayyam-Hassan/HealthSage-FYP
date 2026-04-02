import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error('MONGO_URI is not set');
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
  mongoUri,
  mongoDbName: process.env.MONGO_DB_NAME ?? 'HealthSage_v1',
  jwtSecret: process.env.JWT_SECRET ?? 'change_me_in_dev_only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  fastApiBaseUrl: process.env.FASTAPI_BASE_URL ?? 'http://localhost:8000/api/v1',
  corsOrigins,
} as const;

