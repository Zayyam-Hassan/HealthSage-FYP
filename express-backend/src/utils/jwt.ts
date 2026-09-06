import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../types/roles';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}

