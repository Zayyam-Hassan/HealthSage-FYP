import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import Card from './index';

interface ReportCardProps {
  title: string;
  date: string;
  type: string;
  preview?: string;
  onPress?: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({
  title,
  date,
  type,
  preview,
  onPress,
}) => {
  return (
    <Card onPress={onPress} className="mb-4 border-border/90">
      <View className="flex-row items-start mb-3">
        <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center mr-4 border border-primary/10">
          <Ionicons name="document-text-outline" size={24} color={colors.primary.main} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-base font-semibold text-text mb-1 tracking-tight">{title}</Text>
          <View className="bg-primary/10 px-3 py-1 rounded-full self-start mb-2 border border-primary/10">
            <Text className="text-[11px] font-semibold text-primary uppercase tracking-wide">
              {type}
            </Text>
          </View>
          {preview ? (
            <Text className="text-sm text-text-secondary leading-5" numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row items-center pt-2 border-t border-border/60">
        <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
        <Text className="text-xs text-text-tertiary ml-1.5">{date}</Text>
      </View>
    </Card>
  );
};

export default ReportCard;
