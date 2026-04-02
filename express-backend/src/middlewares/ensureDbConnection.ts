import type { NextFunction, Request, Response } from 'express';
import { connectToDatabase } from '../config/db';

/**
 * Lightweight routes that must not block on Mongo (liveness / probes).
 * Use originalUrl so paths match correctly when routers are mounted (req.path is relative).
 */
function shouldSkipDbConnection(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const p = (req.originalUrl || req.url || '').split('?')[0];
  if (p === '/') return true;
  if (p === '/health') return true;
  if (p === '/api/v1/health') return true;
  return false;
}

/**
 * Ensures MongoDB is connected before handlers that use Mongoose models.
 * Skips fast health checks; `/api/v1/health/db` runs after this (connect + ping in route).
 */
export function ensureDbConnection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (shouldSkipDbConnection(req)) {
    next();
    return;
  }

  connectToDatabase()
    .then(() => next())
    .catch((err: unknown) => {
      next(err);
    });
}
