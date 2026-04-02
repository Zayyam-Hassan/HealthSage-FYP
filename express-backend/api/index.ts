import app from '../src/app';
import { connectMongo } from '../src/db/mongoose';

export default async function handler(req: any, res: any): Promise<void> {
  try {
    await connectMongo();
    app(req, res);
  } catch (error: any) {
    console.error('Failed to initialize MongoDB for Vercel request', error);
    res.status(500).json({
      message: 'Database connection failed',
      detail: error?.message ?? 'Unknown error',
    });
  }
}
