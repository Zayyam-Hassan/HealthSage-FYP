import { ReactNode } from 'react';

export type InputType = 'text' | 'email' | 'password' | 'phone' | 'number' | 'search';

export type PasswordAutoFillMode = 'current' | 'new';

export interface InputProps {
  type?: InputType;
  /** For `password` fields: saved password vs new password (signup). Enables OS autofill. */
  passwordMode?: PasswordAutoFillMode;
  /** Set for username fields so the OS can suggest saved accounts (e.g. signup). */
  usernameField?: boolean;
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  className?: string;
  secureTextEntry?: boolean;
}

