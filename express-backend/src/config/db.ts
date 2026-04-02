import mongoose from 'mongoose';
import { env } from './env';

mongoose.set('bufferCommands', false);

type MongooseGlobal = typeof globalThis & {
  __mongooseConnectionPromise?: Promise<typeof mongoose>;
};

const g = globalThis as MongooseGlobal;

/**
 * Serverless-safe: reuse one connection promise across Vercel invocations.
 * bufferCommands is disabled so failures surface immediately instead of hanging.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!g.__mongooseConnectionPromise) {
    g.__mongooseConnectionPromise = mongoose
      .connect(env.mongoUri, {
        dbName: env.mongoDbName,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        maxPoolSize: 10,
      })
      .then((m) => {
        // eslint-disable-next-line no-console
        console.log('✅ MongoDB connected');
        return m;
      })
      .catch((err: unknown) => {
        g.__mongooseConnectionPromise = undefined;
        // eslint-disable-next-line no-console
        console.error('❌ MongoDB connection failed:', err);
        throw err;
      });
  }

  return g.__mongooseConnectionPromise;
}
