import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';
import { images } from '@/constants/images';

export type HeaderVariant = 'default' | 'coral';

interface HeaderProps {
  title?: string;
  /** Shown under `title` in the `coral` variant (e.g. patient name). */
  subtitle?: string;
  showBack?: boolean;
  rightActions?: React.ReactNode;
  onBackPress?: () => void;
  showLogo?: boolean;
  className?: string;
  /** `coral` matches Records / report viewer: coral strip + white rounded bar. */
  variant?: HeaderVariant;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  rightActions,
  onBackPress,
  showLogo = false,
  className = '',
  variant = 'default',
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

  if (variant === 'coral') {
    return (
      <View className={`bg-coral px-4 pb-3 pt-2 ${className}`.trim().replace(/\s+/g, ' ')}>
        <View className="flex-row items-center rounded-full bg-white px-1.5 py-1.5 shadow-sm shadow-black/5">
          {showBack ? (
            <TouchableOpacity
              onPress={handleBackPress}
              className="h-11 w-11 items-center justify-center"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons
                name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
                size={Platform.OS === 'ios' ? 26 : 22}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          ) : (
            <View className="h-11 w-11" />
          )}
          {showLogo && !title ? (
            <View className="flex-1 items-center justify-center py-1">
              <Image
                source={images.healthsageLogo}
                className="h-8 w-32"
                resizeMode="contain"
              />
            </View>
          ) : null}
          {title ? (
            <View className="flex-1 justify-center px-1">
              <Text
                className="text-center text-base font-bold text-text"
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  className="mt-0.5 text-center text-xs text-text-secondary"
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {rightActions ? (
            <View className="min-h-[44px] flex-row items-center justify-end">{rightActions}</View>
          ) : (
            <View className="h-11 w-11" />
          )}
        </View>
      </View>
    );
  }

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
