import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import { colors } from '@/constants/colors';

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
    <Card onPress={onPress} className={`mb-3 border-border/80 ${className}`}>
      <View className="flex-row items-center">
        <Avatar name={patient.name} size="md" className="mr-3" />
        <View className="flex-1 min-w-0">
          <View className="mb-1 flex-row items-center justify-between gap-2">
            <Text className="text-base font-semibold text-text flex-shrink" numberOfLines={1}>
              {patient.name}
            </Text>
            {patient.riskClass && (
              <Badge variant={getRiskBadgeVariant(patient.riskClass)} size="sm">
                {patient.riskClass.toUpperCase()}
              </Badge>
            )}
          </View>
          <Text className="text-sm text-text-secondary">
            {patient.age} yrs · {patient.gender}
          </Text>
          {patient.conditions.length > 0 && (
            <Text className="text-xs text-text-tertiary mt-1" numberOfLines={2}>
              {patient.conditions.join(' · ')}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} style={{ marginLeft: 8 }} />
      </View>
    </Card>
  );
};

export default PatientCard;
