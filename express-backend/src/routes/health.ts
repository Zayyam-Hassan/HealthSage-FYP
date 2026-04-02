import { Router } from 'express';
import mongoose from 'mongoose';
import { connectToDatabase } from '../config/db';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/health/db', async (_req, res, next) => {
  try {
    await connectToDatabase();
    res.json({
      readyState: mongoose.connection.readyState,
      dbName: mongoose.connection.db?.databaseName ?? null,
      host: mongoose.connection.host ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export { router as healthRouter };

