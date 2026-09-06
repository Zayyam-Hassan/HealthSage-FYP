import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { UserRole } from '../types/roles';

export interface UserDocument extends Document {
  email: string;
  display_name: string;
  role: UserRole;
  avatar_url?: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date | null;
  disabled: boolean;
  hashed_password: string;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true },
    display_name: { type: String, required: true },
    role: {
      type: String,
      enum: ['doctor', 'patient', 'admin'],
      required: true,
    },
    avatar_url: { type: String, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
    last_login_at: { type: Date, default: null },
    disabled: { type: Boolean, default: false },
    hashed_password: { type: String, required: true },
  },
  {
    collection: 'users',
  },
);

UserSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);

