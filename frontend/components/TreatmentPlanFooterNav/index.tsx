import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';

export type TreatmentPlanFooterTab = 'current' | 'past' | 'create';

function TabButton({
  focused,
  icon,
  label,
  onPress,
}: {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 items-center justify-center py-1"
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
    >
      {focused ? (
        <View
          className="h-10 w-10 items-center justify-center rounded-2xl bg-primary"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <Ionicons name={icon} size={20} color={colors.primary.contrast} />
        </View>
      ) : (
        <View className="h-10 w-10 items-center justify-center">
          <Ionicons name={icon} size={20} color={colors.text.tertiary} />
        </View>
      )}
      <Text
        className={`mt-0.5 text-[10px] font-semibold ${focused ? 'text-text' : 'text-text-tertiary'}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type Props = {
  tab: TreatmentPlanFooterTab;
  onTabChange: (t: TreatmentPlanFooterTab) => void;
};

/** Bottom tabs: current plan · history · author (matches Records / Upload pattern). */
export default function TreatmentPlanFooterNav({ tab, onTabChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-border/80 bg-bg-secondary"
      style={{
        paddingBottom: Math.max(insets.bottom, 10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 12,
      }}
    >
      <View className="h-[62px] flex-row items-center justify-around px-1 pt-1">
        <TabButton
          focused={tab === 'current'}
          icon="pulse-outline"
          label="Current"
          onPress={() => onTabChange('current')}
        />
        <TabButton
          focused={tab === 'past'}
          icon="time-outline"
          label="Past"
          onPress={() => onTabChange('past')}
        />
        <TabButton
          focused={tab === 'create'}
          icon="create-outline"
          label="Create"
          onPress={() => onTabChange('create')}
        />
      </View>
    </View>
  );
}
