import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { Medication } from '@/constants/mockMedications';

interface MedicationCardProps {
  medication: Medication;
  onPress?: () => void;
  className?: string;
}

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onPress,
  className = '',
}) => {
  return (
    <Card onPress={onPress} className={`mb-3 ${className}`}>
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-base font-semibold text-text mb-1">
            {medication.name}
          </Text>
          <Text className="text-sm text-text-secondary">
            {medication.brand}
          </Text>
        </View>
        <Badge variant="info" size="sm">
          {medication.category}
        </Badge>
      </View>
      <Text className="text-xs text-text-tertiary" numberOfLines={2}>
        {medication.description}
      </Text>
      <Text className="text-xs text-primary mt-2 font-medium">
        Dosage: {medication.dosage}
      </Text>
    </Card>
  );
};

export default MedicationCard;


