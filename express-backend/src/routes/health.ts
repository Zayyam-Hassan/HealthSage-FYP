import type { Request, Response } from 'express';
import { Router } from 'express';
import mongoose from 'mongoose';
import { connectToDatabase } from '../config/db';

/**
 * Mongo ping — exported so app.ts can register GET /api/v1/health/db explicitly
 * (avoids 404s when nested router paths behave oddly behind some proxies).
 */
export async function healthDbHandler(_req: Request, res: Response): Promise<void> {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      res.status(500).json({
        status: 'error',
        db: 'disconnected',
        message: 'No database handle on connection',
      });
      return;
    }
    await db.admin().command({ ping: 1 });
    res.status(200).json({
      status: 'ok',
      db: 'connected',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      status: 'error',
      db: 'disconnected',
      message,
    });
  }
}

const router = Router();

/** Register more specific path first */
router.get('/health/db', healthDbHandler);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export { router as healthRouter };
