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

function toAuthUser(doc: { id: string; email: string; display_name: string; role: UserRole }) {
  return {
    id: doc.id,
    email: doc.email,
    display_name: doc.display_name,
    role: doc.role,
  };
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
