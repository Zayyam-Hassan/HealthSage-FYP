import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

type Props = {
  title: string;
  onBack: () => void;
};

/** Coral bar + white rounded inner row — shared by Reports, Health Assessment, etc. */
export default function MedicalReportHeader({ title, onBack }: Props) {
  return (
    <View className="bg-coral px-4 pb-3 pt-2">
      <View className="flex-row items-center rounded-2xl bg-white px-1 py-1.5 shadow-sm shadow-black/5">
        <TouchableOpacity
          onPress={onBack}
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
        <Text className="flex-1 text-center text-base font-bold text-text" numberOfLines={1}>
          {title}
        </Text>
        <View className="h-11 w-11" />
      </View>
    </View>
  );
}
