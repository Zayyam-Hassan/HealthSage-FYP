import React from 'react';
import { View, Text } from 'react-native';
import Card from './index';

interface AppointmentCardProps {
  date: string;
  time: string;
  doctorName: string;
  specialty: string;
  status:
    | 'available'
    | 'booked'
    | 'blocked'
    | 'cancelled'
    | 'completed'
    | 'no_show'
    | 'upcoming';
  onPress?: () => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  date,
  time,
  doctorName,
  specialty,
  status,
  onPress,
}) => {
  const statusColors = {
    available: 'bg-success/10',
    booked: 'bg-info/10',
    blocked: 'bg-warning/10',
    no_show: 'bg-warning/10',
    upcoming: 'bg-info/10',
    completed: 'bg-success/10',
    cancelled: 'bg-error/10',
  };

  const statusTextColors = {
    available: 'text-success',
    booked: 'text-info',
    blocked: 'text-warning',
    no_show: 'text-warning',
    upcoming: 'text-info',
    completed: 'text-success',
    cancelled: 'text-error',
  };

  const statusLabel = status.replace('_', ' ');

  return (
    <Card onPress={onPress} className="mb-4 border-border/90">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 pr-2">
          <Text className="text-base font-semibold text-text mb-1">{doctorName}</Text>
          <Text className="text-sm text-text-secondary">{specialty}</Text>
        </View>
        <View className={`px-3 py-1.5 rounded-full ${statusColors[status]} border border-black/5`}>
          <Text className={`text-xs font-semibold capitalize ${statusTextColors[status]}`}>
            {statusLabel.replace(/_/g, ' ')}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center flex-wrap pt-3 border-t border-border/60 gap-y-2">
        <View className="flex-row items-center mr-6">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mr-2">
            Date
          </Text>
          <Text className="text-sm text-text">{date}</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mr-2">
            Time
          </Text>
          <Text className="text-sm text-text">{time}</Text>
        </View>
      </View>
    </Card>
  );
};

export default AppointmentCard;
