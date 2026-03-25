import React from 'react';
import { View, Text, Image } from 'react-native';

interface AvatarProps {
  source?: { uri: string } | number;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  source,
  name,
  size = 'md',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const textSizeStyles = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-xl',
  };

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View
      className={`
        ${sizeStyles[size]}
        rounded-full
        bg-primary/20
        items-center
        justify-center
        overflow-hidden
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {source ? (
        <Image
          source={source}
          className={`${sizeStyles[size]} rounded-full`}
          resizeMode="cover"
        />
      ) : name ? (
        <Text className={`${textSizeStyles[size]} font-semibold text-primary`}>
          {getInitials(name)}
        </Text>
      ) : (
        <Text className={`${textSizeStyles[size]} font-semibold text-primary`}>
          ?
        </Text>
      )}
    </View>
  );
};

export default Avatar;

