import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { ButtonProps } from './types';

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  icon,
  fullWidth = false,
  children,
  className = '',
}) => {
  const isDisabled = disabled || loading;

  // Variant styles
  const variantStyles = {
    primary: 'bg-primary shadow-md',
    secondary: 'bg-secondary shadow-md',
    outline: 'bg-transparent border-2 border-primary',
    text: 'bg-transparent',
    ghost: 'bg-transparent',
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3',
    lg: 'px-8 py-4',
  };

  // Text color based on variant
  const textColorStyles = {
    primary: 'text-white',
    secondary: 'text-white',
    outline: 'text-primary',
    text: 'text-primary',
    ghost: 'text-text',
  };

  // Text size
  const textSizeStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const baseStyles = `
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${fullWidth ? 'w-full' : ''}
    ${isDisabled ? 'opacity-50' : ''}
    rounded-xl
    flex-row
    items-center
    justify-center
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={baseStyles}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'secondary' ? '#FFFFFF' : '#faad9e'}
        />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text
            className={`
              ${textColorStyles[variant]}
              ${textSizeStyles[size]}
              font-semibold
            `.trim().replace(/\s+/g, ' ')}
          >
            {children}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;

