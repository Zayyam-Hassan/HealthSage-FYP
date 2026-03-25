import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onActionPress,
  className = '',
}) => {
  return (
    <View
      className={`
        flex-row
        justify-between
        items-center
        mb-4
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <Text className="text-lg font-bold text-text">{title}</Text>
      {actionLabel && onActionPress && (
        <TouchableOpacity onPress={onActionPress}>
          <Text className="text-sm text-primary font-medium">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SectionHeader;

