import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { colors } from '@/constants/colors';

interface LoaderProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({
  size = 'large',
  color = colors.primary.main,
  text,
  fullScreen = false,
}) => {
  const content = (
    <View className="items-center justify-center">
      <ActivityIndicator size={size} color={color} />
      {text ? (
        <Text className="text-text-secondary mt-4 text-sm leading-6">{text}</Text>
      ) : null}
    </View>
  );

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {content}
      </View>
    );
  }

  return content;
};

export default Loader;

