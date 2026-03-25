import React from 'react';
import { View, Text } from 'react-native';
import Card from './index';

interface AppointmentCardProps {
  date: string;
  time: string;
  doctorName: string;
  specialty: string;
  status: 'upcoming' | 'completed' | 'cancelled';
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
    upcoming: 'bg-info/10',
    completed: 'bg-success/10',
    cancelled: 'bg-error/10',
  };

  const statusTextColors = {
    upcoming: 'text-info',
    completed: 'text-success',
    cancelled: 'text-error',
  };

  return (
    <Card onPress={onPress} className="mb-4 border border-border/50">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-base font-bold text-text mb-1">{doctorName}</Text>
          <Text className="text-sm text-text-secondary">{specialty}</Text>
        </View>
        <View className={`px-3 py-1.5 rounded-full ${statusColors[status]} shadow-sm`}>
          <Text className={`text-xs font-semibold capitalize ${statusTextColors[status]}`}>
            {status}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center pt-3 border-t border-border/30">
        <View className="flex-row items-center mr-4">
          <Text className="text-sm text-text-secondary mr-2">Date</Text>
          <Text className="text-sm text-text-secondary">{date}</Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-sm text-text-secondary mr-2">Time</Text>
          <Text className="text-sm text-text-secondary">{time}</Text>
        </View>
      </View>
    </Card>
  );
};

export default AppointmentCard;
