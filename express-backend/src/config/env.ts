import dotenv from 'dotenv';

dotenv.config();

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
  port: Number(process.env.PORT ?? 9000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGO_DB_NAME ?? 'HealthSage_v1',
  jwtSecret: process.env.JWT_SECRET ?? 'change_me_in_dev_only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  fastApiBaseUrl: process.env.FASTAPI_BASE_URL ?? 'http://localhost:8000/api/v1',
  corsOrigins,
} as const;

