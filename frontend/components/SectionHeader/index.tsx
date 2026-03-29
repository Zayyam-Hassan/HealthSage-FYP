import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  eyebrow,
  subtitle,
  actionLabel,
  onActionPress,
  className = '',
}) => {
  return (
    <View
      className={`
        flex-row
        justify-between
        items-start
        mb-3
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <View className="flex-1 pr-3">
        {eyebrow ? (
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-base font-semibold text-text leading-6">{title}</Text>
        {subtitle ? (
          <Text className="text-sm text-text-secondary mt-1 leading-5">{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel && onActionPress && (
        <TouchableOpacity onPress={onActionPress} className="pt-0.5" hitSlop={8}>
          <Text className="text-sm font-semibold text-primary">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SectionHeader;

