import { StatusCodes } from 'http-status-codes';
import type { NextFunction, Request, Response } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { verifyAccessToken } from '../../utils/jwt';

jest.mock('../../utils/jwt', () => ({
  verifyAccessToken: jest.fn(),
}));

function buildRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { res: { status } as unknown as Response, status, json };
}

describe('auth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when token is missing', () => {
    const req = { header: jest.fn(() => null), query: {} } as unknown as Request;
    const { res, status, json } = buildRes();
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts bearer token and calls next', () => {
    const req = { header: jest.fn(() => 'Bearer token-123'), query: {} } as unknown as Request;
    const { res } = buildRes();
    const next = jest.fn() as NextFunction;
    (verifyAccessToken as jest.Mock).mockReturnValue({ sub: 'u1', role: 'doctor', email: 'a@a.com' });

    requireAuth(req, res, next);

    expect(verifyAccessToken).toHaveBeenCalledWith('token-123');
    expect((req as Request).user?.sub).toBe('u1');
    expect(next).toHaveBeenCalled();
  });

  it('accepts token from query string', () => {
    const req = { header: jest.fn(() => null), query: { access_token: 'q-token' } } as unknown as Request;
    const { res } = buildRes();
    const next = jest.fn() as NextFunction;
    (verifyAccessToken as jest.Mock).mockReturnValue({ sub: 'u2', role: 'patient', email: 'p@a.com' });

    requireAuth(req, res, next);
    expect(verifyAccessToken).toHaveBeenCalledWith('q-token');
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 for invalid token', () => {
    const req = { header: jest.fn(() => 'Bearer bad-token'), query: {} } as unknown as Request;
    const { res, status, json } = buildRes();
    const next = jest.fn() as NextFunction;
    (verifyAccessToken as jest.Mock).mockImplementation(() => {
      throw new Error('bad token');
    });

    requireAuth(req, res, next);

    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('enforces role checks', () => {
    const middleware = requireRole('doctor');
    const req = { user: { role: 'patient' } } as unknown as Request;
    const { res, status, json } = buildRes();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);

    expect(status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({ message: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns unauthorized when role middleware has no user', () => {
    const middleware = requireRole('doctor');
    const req = {} as Request;
    const { res, status, json } = buildRes();
    const next = jest.fn() as NextFunction;

    middleware(req, res, next);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  it('passes role middleware when role matches', () => {
    const middleware = requireRole(['doctor', 'patient']);
    const req = { user: { role: 'patient' } } as unknown as Request;
    const { res } = buildRes();
    const next = jest.fn() as NextFunction;
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
