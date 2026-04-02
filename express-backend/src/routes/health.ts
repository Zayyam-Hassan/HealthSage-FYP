import { Router } from 'express';
import mongoose from 'mongoose';
import { connectToDatabase } from '../config/db';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Verifies MongoDB connectivity (Atlas / serverless-safe).
 * GET /api/v1/health/db when mounted under /api/v1
 */
router.get('/health/db', async (_req, res) => {
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
});

export { router as healthRouter };
