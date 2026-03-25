import React from 'react';
import { View, Text } from 'react-native';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';

interface PatientCardData {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  conditions: string[];
  riskClass?: 'low' | 'medium' | 'high';
}

interface PatientCardProps {
  patient: PatientCardData;
  onPress?: () => void;
  className?: string;
}

const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  onPress,
  className = '',
}) => {
  const getRiskBadgeVariant = (
    riskClass?: string,
  ): 'success' | 'warning' | 'error' => {
    if (riskClass === 'low') return 'success';
    if (riskClass === 'medium') return 'warning';
    return 'error';
  };

  return (
    <Card onPress={onPress} className={`mb-3 ${className}`}>
      <View className="flex-row items-center">
        <Avatar name={patient.name} size="md" className="mr-4" />
        <View className="flex-1">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-text">
              {patient.name}
            </Text>
            {patient.riskClass && (
              <Badge variant={getRiskBadgeVariant(patient.riskClass)} size="sm">
                {patient.riskClass.toUpperCase()}
              </Badge>
            )}
          </View>
          <Text className="mb-1 text-sm text-text-secondary">
            Age: {patient.age} | {patient.gender}
          </Text>
          {patient.conditions.length > 0 && (
            <Text className="text-xs text-text-tertiary" numberOfLines={1}>
              {patient.conditions.join(', ')}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
};

export default PatientCard;
