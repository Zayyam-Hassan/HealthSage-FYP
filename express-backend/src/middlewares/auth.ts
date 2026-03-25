import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { JwtPayload } from '../utils/jwt';
import { verifyAccessToken } from '../utils/jwt';
import type { UserRole } from '../types/roles';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

function extractToken(req: Request): string | null {
  const header = req.header('Authorization');
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(required: UserRole | UserRole[]) {
  const roles = Array.isArray(required) ? required : [required];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }
    next();
  };
}

