import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

type Props = {
  /** Shown above the name, e.g. "Record for" */
  label?: string;
  /** Primary name — coral accent */
  name: string;
  /** Optional subtitle (age, ID) */
  subtitle?: string | null;
  /** When set, shows pencil and calls on press */
  onPressEdit?: () => void;
  className?: string;
};

/**
 * Compact patient context header — white card, coral name, pencil to open lookup (not long chip lists).
 */
export default function RecordForPatientHeader({
  label = 'Record for',
  name,
  subtitle,
  onPressEdit,
  className = '',
}: Props) {
  return (
    <View className={`rounded-t-[20px] bg-white px-4 pt-3 ${className}`.trim()}>
      <Text className="text-sm font-medium text-text">{label}</Text>
      <View className="mt-1 flex-row items-center justify-between pb-3">
        <View className="min-w-0 flex-1 pr-2">
          <Text
            className="text-lg font-semibold text-coral-deep"
            numberOfLines={2}
          >
            {name}
          </Text>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-text-secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onPressEdit ? (
          <TouchableOpacity
            onPress={onPressEdit}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Change patient"
          >
            <Ionicons name="pencil" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View className="h-px w-full bg-border/60" />
    </View>
  );
}
