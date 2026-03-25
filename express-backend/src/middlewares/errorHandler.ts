import type { NextFunction, Request, Response } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

// Basic centralized error handler; can be extended as needed.
// TODO: align error response shape with existing frontend ApiError if necessary.
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status =
    typeof err.status === 'number' && err.status >= 400 && err.status < 600
      ? err.status
      : StatusCodes.INTERNAL_SERVER_ERROR;

  const message =
    typeof err.message === 'string' && err.message.length > 0
      ? err.message
      : getReasonPhrase(status);

  res.status(status).json({
    message,
    detail: err.detail ?? undefined,
  });
}

