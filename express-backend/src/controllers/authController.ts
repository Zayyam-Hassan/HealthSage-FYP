import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { createWelcomeNotificationForUser } from '../services/notificationsService';
import { signAccessToken } from '../utils/jwt';
import type { UserRole } from '../types/roles';

const SignupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['doctor', 'patient']),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());

const UpdateProfileSchema = z.object({
  display_name: optionalTrimmedString,
  email: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().email().optional()),
  phone: optionalTrimmedString,
  specialization: optionalTrimmedString,
  bio: optionalTrimmedString,
  accepting_patients: z.boolean().optional(),
  full_name: optionalTrimmedString,
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

const UploadAvatarSchema = z.object({
  file_name: z.string().min(1).max(180),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  file_data_base64: z.string().min(1),
});

const avatarMimeTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const AVATAR_DIR = path.join(process.cwd(), 'uploaded-avatars');
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

function toAuthUser(doc: {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  avatar_url?: string | null;
}) {
  return {
    id: doc.id,
    email: doc.email,
    display_name: doc.display_name,
    role: doc.role,
    avatar_url: doc.avatar_url ?? null,
  };
}

function extractAvatarFileName(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  const match = avatarUrl.match(/\/auth\/avatars\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

async function removeStoredAvatar(avatarUrl?: string | null) {
  const fileName = extractAvatarFileName(avatarUrl);
  if (!fileName) return;
  const target = path.join(AVATAR_DIR, path.basename(fileName));
  await fs.promises.unlink(target).catch(() => undefined);
}

function buildProfileCode(prefix: 'DR' | 'PT', id: string): string {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
}

async function ensureRoleProfile(user: {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
}) {
  const userObjectId = new mongoose.Types.ObjectId(user.id);

  if (user.role === 'doctor') {
    const existingDoctor = await Doctor.findOne({ user_id: userObjectId });
    if (!existingDoctor) {
      await Doctor.create({
        user_id: userObjectId,
        doctor_id: buildProfileCode('DR', user.id),
        name: user.display_name,
        specialization: 'Diabetes Care',
        email: user.email,
        accepting_patients: true,
      });
    }
  }

  if (user.role === 'patient') {
    const existingPatient = await Patient.findOne({ user_id: userObjectId });
    if (!existingPatient) {
      await Patient.create({
        user_id: userObjectId,
        patient_id: buildProfileCode('PT', user.id),
        full_name: user.display_name,
        conditions: [],
      });
    }
  }
}

export async function signup(req: Request, res: Response): Promise<void> {
  const parse = SignupSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid signup payload',
      detail: parse.error.flatten(),
    });
    return;
  }

  const { email, username, password, role } = parse.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(StatusCodes.CONFLICT).json({ message: 'Email already exists' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await User.create({
    email: normalizedEmail,
    display_name: username.trim(),
    role,
    hashed_password: hashed,
    disabled: false,
  });

  await ensureRoleProfile({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
  });
  await createWelcomeNotificationForUser(user.id).catch(() => null);

  const authUser = toAuthUser({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    avatar_url: user.avatar_url,
  });

  const access_token = signAccessToken({
    sub: authUser.id,
    email: authUser.email,
    role: authUser.role,
  });

  res.status(StatusCodes.CREATED).json({
    ...authUser,
    access_token,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parse = LoginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid login payload',
      detail: parse.error.flatten(),
    });
    return;
  }

  const { email, password } = parse.data;
  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail, disabled: false });
  if (!user) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: 'Invalid email or password' });
    return;
  }

  const ok = await bcrypt.compare(password, user.hashed_password);
  if (!ok) {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: 'Invalid email or password' });
    return;
  }

  user.last_login_at = new Date();
  await user.save();
  await ensureRoleProfile({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
  });

  const authUser = toAuthUser({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    avatar_url: user.avatar_url,
  });

  const access_token = signAccessToken({
    sub: authUser.id,
    email: authUser.email,
    role: authUser.role,
  });

  res.json({
    ...authUser,
    access_token,
  });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const user = await User.findById(req.user.sub);
  if (!user || user.disabled) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const authUser = toAuthUser({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    avatar_url: user.avatar_url,
  });

  await ensureRoleProfile(authUser);

  res.json(authUser);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const parse = UpdateProfileSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid profile payload',
      detail: parse.error.flatten(),
    });
    return;
  }

  const user = await User.findById(req.user.sub);
  if (!user || user.disabled) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const { display_name, email, phone, specialization, bio, accepting_patients, full_name } =
    parse.data;

  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: user._id },
    });
    if (existing) {
      res.status(StatusCodes.CONFLICT).json({ message: 'Email already exists' });
      return;
    }
    user.email = email.toLowerCase();
  }

  if (display_name) {
    user.display_name = display_name.trim();
  }

  await user.save();

  if (user.role === 'doctor') {
    const doctor = await Doctor.findOne({ user_id: user._id });
    if (doctor) {
      doctor.name = display_name?.trim() || doctor.name;
      doctor.email = user.email;
      if (phone !== undefined) doctor.phone = phone.trim();
      if (specialization !== undefined) doctor.specialization = specialization.trim();
      if (bio !== undefined) doctor.bio = bio.trim();
      if (accepting_patients !== undefined) {
        doctor.accepting_patients = accepting_patients;
      }
      await doctor.save();
    }
  }

  if (user.role === 'patient') {
    const patient = await Patient.findOne({ user_id: user._id });
    if (patient) {
      patient.full_name = full_name?.trim() || display_name?.trim() || patient.full_name;
      await patient.save();
    }
  }

  const authUser = toAuthUser({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    avatar_url: user.avatar_url,
  });

  res.json(authUser);
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const parse = ChangePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid password payload',
      detail: parse.error.flatten(),
    });
    return;
  }

  const user = await User.findById(req.user.sub);
  if (!user || user.disabled) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const { current_password, new_password } = parse.data;

  const matchesCurrent = await bcrypt.compare(current_password, user.hashed_password);
  if (!matchesCurrent) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Current password is incorrect' });
    return;
  }

  const isSamePassword = await bcrypt.compare(new_password, user.hashed_password);
  if (isSamePassword) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'New password must be different from current password',
    });
    return;
  }

  user.hashed_password = await bcrypt.hash(new_password, 12);
  await user.save();

  res.json({ message: 'Password updated successfully' });
}

export async function uploadMeAvatar(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const parse = UploadAvatarSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid avatar payload',
      detail: parse.error.flatten(),
    });
    return;
  }

  const user = await User.findById(req.user.sub);
  if (!user || user.disabled) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Unauthorized' });
    return;
  }

  const extension = avatarMimeTypes[parse.data.mime_type];
  const buffer = Buffer.from(parse.data.file_data_base64, 'base64');

  if (!buffer.length) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Avatar image is empty',
    });
    return;
  }

  if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Avatar image must be 5MB or smaller',
    });
    return;
  }

  await fs.promises.mkdir(AVATAR_DIR, { recursive: true });
  await removeStoredAvatar(user.avatar_url);

  const fileName = `${user.id}-${Date.now()}.${extension}`;
  const filePath = path.join(AVATAR_DIR, fileName);
  await fs.promises.writeFile(filePath, buffer);

  user.avatar_url = `/auth/avatars/${fileName}`;
  await user.save();

  res.json(
    toAuthUser({
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      avatar_url: user.avatar_url,
    }),
  );
}

export async function getAvatar(req: Request, res: Response): Promise<void> {
  const fileName = path.basename(req.params.filename ?? '');
  if (!fileName) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Avatar not found' });
    return;
  }

  const filePath = path.join(AVATAR_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Avatar not found' });
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(filePath);
}
