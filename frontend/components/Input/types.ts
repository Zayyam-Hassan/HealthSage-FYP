import { ReactNode } from 'react';

export type InputType = 'text' | 'email' | 'password' | 'phone' | 'number' | 'search';

export interface InputProps {
  type?: InputType;
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

