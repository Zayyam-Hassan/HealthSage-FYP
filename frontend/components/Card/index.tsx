import React from 'react';
import { View, TouchableOpacity } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const Card: React.FC<CardProps> = ({
  children,
  onPress,
  className = '',
  padding = 'md',
}) => {
  const paddingStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const baseStyles = `
    bg-bg-card
    rounded-xl
    shadow-sm
    ${paddingStyles[padding]}
    ${onPress ? '' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className={baseStyles}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View className={baseStyles}>{children}</View>;
};

export default Card;

