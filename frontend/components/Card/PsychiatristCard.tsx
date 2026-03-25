import React from 'react';
import { View, Text, Image } from 'react-native';
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
    <Card onPress={onPress} className="mb-4 border border-border/50">
      <View className="flex-row items-center">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="w-20 h-20 rounded-full mr-4 border-2 border-primary/20"
            resizeMode="cover"
          />
        ) : (
          <View className="w-20 h-20 rounded-full mr-4 bg-primary/10 items-center justify-center border-2 border-primary/20">
            <Text className="text-3xl">👤</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-lg font-bold text-text mb-1">{name}</Text>
          <Text className="text-sm text-text-secondary mb-2">{specialty}</Text>
          <View className="flex-row items-center mb-2">
            <View className="flex-row items-center bg-warning/10 px-2 py-1 rounded-full mr-2">
              <Text className="text-sm text-warning mr-1">★</Text>
              <Text className="text-sm font-semibold text-text">{rating.toFixed(1)}</Text>
            </View>
            <Text className="text-sm text-text-tertiary mr-2">•</Text>
            <Text className="text-sm text-text-secondary">{location}</Text>
          </View>
          {availability && (
            <View className="bg-success/10 px-3 py-1 rounded-full self-start">
              <Text className="text-xs font-medium text-success">{availability}</Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

export default PsychiatristCard;

