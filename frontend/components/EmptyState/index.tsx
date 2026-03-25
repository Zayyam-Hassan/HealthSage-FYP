import React from 'react';
import { View, Text } from 'react-native';
import Button from '../Button';

interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  onActionPress,
  icon,
}) => {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      {icon && <View className="mb-4">{icon}</View>}
      <Text className="text-xl font-bold text-text mb-2 text-center">
        {title}
      </Text>
      {message && (
        <Text className="text-base text-text-secondary text-center mb-6">
          {message}
        </Text>
      )}
      {actionLabel && onActionPress && (
        <Button onPress={onActionPress} variant="primary">
          {actionLabel}
        </Button>
      )}
    </View>
  );
};

export default EmptyState;

