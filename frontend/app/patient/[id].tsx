import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';
import SectionHeader from '@/components/SectionHeader';
import AppointmentCard from '@/components/Card/AppointmentCard';

export default function PatientDetailsScreen() {
  const { id } = useLocalSearchParams();

  // Mock data
  const patient = {
    id: id as string,
    name: 'John Doe',
    age: 35,
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main St, New York, NY 10001',
  };

  const appointments = [
    {
      id: '1',
      date: 'Dec 15, 2024',
      time: '10:00 AM',
      doctorName: 'Dr. Sarah Johnson',
      specialty: 'Psychiatrist',
      status: 'upcoming' as const,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Patient Details" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          {/* Patient Info */}
          <Card className="mb-4">
            <View className="flex-row items-center mb-4">
              <Avatar name={patient.name} size="lg" className="mr-4" />
              <View className="flex-1">
                <Text className="text-xl font-bold text-text mb-1">
                  {patient.name}
                </Text>
                <Text className="text-sm text-text-secondary">
                  Age: {patient.age}
                </Text>
              </View>
            </View>
            <View className="border-t border-border pt-4">
              <View className="mb-3">
                <Text className="text-sm text-text-secondary mb-1">Email</Text>
                <Text className="text-base text-text">{patient.email}</Text>
              </View>
              <View className="mb-3">
                <Text className="text-sm text-text-secondary mb-1">Phone</Text>
                <Text className="text-base text-text">{patient.phone}</Text>
              </View>
              <View>
                <Text className="text-sm text-text-secondary mb-1">Address</Text>
                <Text className="text-base text-text">{patient.address}</Text>
              </View>
            </View>
          </Card>

          {/* Appointments */}
          <SectionHeader title="Appointments" />
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              date={appointment.date}
              time={appointment.time}
              doctorName={appointment.doctorName}
              specialty={appointment.specialty}
              status={appointment.status}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

