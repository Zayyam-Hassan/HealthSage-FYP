import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = env.mongoUri;
  const dbName = env.mongoDbName;

  // Use the same DB name convention as FastAPI backend
  return mongoose.connect(uri, {
    dbName,
  });
}

