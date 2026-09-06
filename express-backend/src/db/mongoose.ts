import mongoose from 'mongoose';
import { env } from '../config/env';

mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 5000);

let cachedConnectionPromise: Promise<typeof mongoose> | null = null;

export async function connectMongo(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!cachedConnectionPromise) {
    cachedConnectionPromise = mongoose
      .connect(env.mongoUri, {
        dbName: env.mongoDbName,
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        maxPoolSize: 10,
      })
      .catch((error) => {
        cachedConnectionPromise = null;
        throw error;
      });
  }

  return cachedConnectionPromise;
}
