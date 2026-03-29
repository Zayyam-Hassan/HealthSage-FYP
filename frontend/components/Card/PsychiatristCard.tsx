import React from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import Card from './index';

interface PsychiatristCardProps {
  name: string;
  specialty: string;
  rating: number;
  location: string;
  imageUrl?: string;
  availability?: string;
  onPress?: () => void;
}

const PsychiatristCard: React.FC<PsychiatristCardProps> = ({
  name,
  specialty,
  rating,
  location,
  imageUrl,
  availability,
  onPress,
}) => {
  return (
    <Card onPress={onPress} className="mb-4 border-border/90">
      <View className="flex-row items-center">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="w-20 h-20 rounded-2xl mr-4 border border-border/80"
            resizeMode="cover"
          />
        ) : (
          <View className="w-20 h-20 rounded-2xl mr-4 bg-primary/10 items-center justify-center border border-primary/15">
            <Ionicons name="person" size={36} color={colors.primary.main} />
          </View>
        )}
        <View className="flex-1 min-w-0">
          <Text className="text-lg font-semibold text-text mb-1 tracking-tight">{name}</Text>
          <Text className="text-sm text-text-secondary mb-2 leading-5">{specialty}</Text>
          <View className="flex-row items-center flex-wrap mb-2">
            <View className="flex-row items-center bg-warning/10 px-2.5 py-1 rounded-full mr-2 border border-warning/15">
              <Ionicons name="star" size={14} color={colors.status.warning} />
              <Text className="text-sm font-semibold text-text ml-1">{rating.toFixed(1)}</Text>
            </View>
            <Text className="text-sm text-text-secondary">{location}</Text>
          </View>
          {availability ? (
            <View className="bg-success/10 px-3 py-1 rounded-full self-start border border-success/15">
              <Text className="text-xs font-semibold text-success">{availability}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
};

export default PsychiatristCard;
