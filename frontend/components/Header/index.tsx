import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { images } from '@/constants/images';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  rightActions?: React.ReactNode;
  onBackPress?: () => void;
  showLogo?: boolean;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  rightActions,
  onBackPress,
  showLogo = false,
  className = '',
}) => {
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View
      className={`
        flex-row
        items-center
        justify-between
        px-4
        py-3
        bg-background
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
    >
      <View className="flex-row flex-1 items-center">
        {showBack && (
          <TouchableOpacity
            onPress={handleBackPress}
            className="mr-3"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-2xl text-text">{'<'}</Text>
          </TouchableOpacity>
        )}
        {showLogo && !title && (
          <Image
            source={images.healthsageLogo}
            className="h-8 w-32"
            resizeMode="contain"
          />
        )}
        {title && (
          <Text className="flex-1 text-xl font-bold text-text" numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
      {rightActions && <View className="flex-row items-center">{rightActions}</View>}
    </View>
  );
};

export default Header;
