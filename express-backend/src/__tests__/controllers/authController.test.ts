import { StatusCodes } from 'http-status-codes';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { changePassword, getAvatar, login, me, signup } from '../../controllers/authController';
import { BlobModel } from '../../models/Blob';
import { Doctor } from '../../models/Doctor';
import { Patient } from '../../models/Patient';
import { User } from '../../models/User';
import { signAccessToken } from '../../utils/jwt';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('../../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../../models/Doctor', () => ({
  Doctor: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../../models/Patient', () => ({
  Patient: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../../models/Blob', () => ({
  BlobModel: {
    findById: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
  },
}));
jest.mock('../../utils/jwt', () => ({
  signAccessToken: jest.fn(() => 'jwt-token'),
}));
jest.mock('../../services/notificationsService', () => ({
  createWelcomeNotificationForUser: jest.fn().mockResolvedValue(undefined),
}));

function buildRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

function buildResWithSend() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const setHeader = jest.fn();
  const type = jest.fn();
  const send = jest.fn();
  return {
    res: { status, json, setHeader, type, send } as unknown as Response,
    status,
    json,
    setHeader,
    type,
    send,
  };
}

describe('authController.signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Patient.findOne as jest.Mock).mockResolvedValue({ id: 'existing-patient' });
  });

  it('returns 422 for invalid signup payload', async () => {
    const req = { body: { email: 'bad', username: '', password: '1', role: 'admin' } } as unknown as Request;
    const { res, status } = buildRes();
    await signup(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
  });

  it('returns 409 when email exists', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({ id: 'u1' });
    const req = { body: { email: 'a@a.com', username: 'User', password: 'secret1', role: 'patient' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await signup(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.CONFLICT);
    expect(json).toHaveBeenCalledWith({ message: 'Email already exists' });
  });

  it('creates user and returns token', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (User.create as jest.Mock).mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      email: 'a@a.com',
      display_name: 'User',
      role: 'patient',
      avatar_url: null,
    });
    const req = { body: { email: 'a@a.com', username: 'User', password: 'secret1', role: 'patient' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await signup(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(signAccessToken).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'jwt-token' }));
  });
});

describe('authController.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 422 for invalid payload', async () => {
    const req = { body: { email: 'invalid-email', password: '' } } as Request;
    const { res, status, json } = buildRes();

    await login(req, res);

    expect(status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid login payload' }),
    );
  });

  it('returns 401 when user is not found', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    const req = { body: { email: 'a@a.com', password: 'pw' } } as Request;
    const { res, status, json } = buildRes();

    await login(req, res);

    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ message: 'Invalid email or password' });
  });

  it('returns 401 for wrong password', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      email: 'a@a.com',
      display_name: 'User',
      role: 'patient',
      avatar_url: null,
      hashed_password: 'hash',
      save: jest.fn(),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const req = { body: { email: 'a@a.com', password: 'wrong' } } as Request;
    const { res, status, json } = buildRes();
    await login(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(signAccessToken).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ message: 'Invalid email or password' });
  });
});

describe('authController.me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when request has no user', async () => {
    const req = {} as Request;
    const { res, status, json } = buildRes();
    await me(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  it('returns 401 when db user is missing', async () => {
    (User.findById as jest.Mock).mockResolvedValue(null);
    const req = { user: { sub: '507f1f77bcf86cd799439011' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await me(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ message: 'Unauthorized' });
  });

  it('returns authenticated user payload when user exists', async () => {
    (User.findById as jest.Mock).mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      email: 'a@a.com',
      display_name: 'User',
      role: 'patient',
      avatar_url: null,
      disabled: false,
    });
    (Patient.findOne as jest.Mock).mockResolvedValue({ id: 'p1' });
    const req = { user: { sub: '507f1f77bcf86cd799439011' } } as unknown as Request;
    const { res, json } = buildRes();
    await me(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ id: '507f1f77bcf86cd799439011', email: 'a@a.com' }),
    );
  });
});

describe('authController.changePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    const req = { body: { current_password: 'oldpass1', new_password: 'newpass123' } } as unknown as Request;
    const { res, status } = buildRes();
    await changePassword(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
  });

  it('returns 422 for invalid payload', async () => {
    const req = { user: { sub: 'u1' }, body: { current_password: '', new_password: '123' } } as unknown as Request;
    const { res, status } = buildRes();
    await changePassword(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
  });

  it('returns 401 when current password is wrong', async () => {
    (User.findById as jest.Mock).mockResolvedValue({ hashed_password: 'hash', disabled: false });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const req = { user: { sub: 'u1' }, body: { current_password: 'oldpass1', new_password: 'newpass123' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await changePassword(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ message: 'Current password is incorrect' });
  });
});

describe('authController.getAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 for invalid blob id', async () => {
    const req = { params: { filename: 'bad-id' } } as unknown as Request;
    const { res, status } = buildResWithSend();
    await getAvatar(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
  });

  it('returns 404 when blob not found', async () => {
    (BlobModel.findById as jest.Mock).mockResolvedValue(null);
    const req = { params: { filename: '507f1f77bcf86cd799439011' } } as unknown as Request;
    const { res, status } = buildResWithSend();
    await getAvatar(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
  });
});
