import React from 'react';
import Input from '@/components/Input';

interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'email' | 'phone';
  required?: boolean;
  error?: string;
  helperText?: string;
  multiline?: boolean;
  numberOfLines?: number;
  className?: string;
  disabled?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  type = 'text',
  required = false,
  error,
  helperText,
  multiline = false,
  numberOfLines = 1,
  className = '',
  disabled = false,
}) => {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      type={type}
      required={required}
      error={error}
      helperText={helperText}
      multiline={multiline}
      numberOfLines={numberOfLines}
      className={className}
      disabled={disabled}
    />
  );
};

export default FormInput;


