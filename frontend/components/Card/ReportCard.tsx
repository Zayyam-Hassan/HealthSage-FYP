import React from 'react';
import { View, Text } from 'react-native';
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
    <Card onPress={onPress} className="mb-4 border border-border/50">
      <View className="flex-row items-start mb-3">
        <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mr-4">
          <Text className="text-2xl">📄</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-text mb-1">{title}</Text>
          <View className="bg-primary/10 px-3 py-1 rounded-full self-start mb-2">
            <Text className="text-xs font-medium text-primary">{type}</Text>
          </View>
          {preview && (
            <Text className="text-sm text-text-secondary leading-5" numberOfLines={2}>
              {preview}
            </Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center pt-2 border-t border-border/30">
        <Text className="text-xs text-text-tertiary">📅 {date}</Text>
      </View>
    </Card>
  );
};

export default ReportCard;

