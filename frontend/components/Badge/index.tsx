import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    success: 'bg-success/10 text-success',
    error: 'bg-error/10 text-error',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  };

  const sizeStyles = {
    sm: 'px-2 py-1',
    md: 'px-3 py-1.5',
  };

  const textSizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  return (
    <View
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        rounded-full
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <Text className={`${textSizeStyles[size]} font-medium`}>{children}</Text>
    </View>
  );
};

export default Badge;

