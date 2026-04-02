import mongoose from 'mongoose';
import { env } from './env';

let cachedPromise: Promise<typeof mongoose> | null = null;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!cachedPromise) {
    console.log('Connecting to MongoDB...');

    cachedPromise = mongoose
      .connect(env.mongoUri, {
        dbName: env.mongoDbName,
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => {
        console.log('MongoDB connected');
        return m;
      })
      .catch((err) => {
        console.error('MongoDB connection failed:', err);
        cachedPromise = null;
        throw err;
      });
  }

  return cachedPromise;
}
