import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';
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
        border-b border-border/80
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
    >
      <View className="flex-row flex-1 items-center min-h-[44px]">
        {showBack && (
          <TouchableOpacity
            onPress={handleBackPress}
            className="mr-2 -ml-1 w-11 h-11 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons
              name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
              size={Platform.OS === 'ios' ? 28 : 24}
              color={colors.text.primary}
            />
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
          <Text
            className="flex-1 text-xl font-bold text-text tracking-tight"
            numberOfLines={1}
          >
            {title}
          </Text>
        )}
      </View>
      {rightActions && <View className="flex-row items-center">{rightActions}</View>}
    </View>
  );
};

export default Header;
