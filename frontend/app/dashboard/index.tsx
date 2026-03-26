import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Card from '@/components/Card';
import Header from '@/components/Header';
import { authService, type UserRole } from '@/services/auth';

type DashboardLink = {
  id: string;
  title: string;
  description: string;
  route: string;
};

const doctorLinks: DashboardLink[] = [
  {
    id: 'patients',
    title: 'Patients',
    description: 'Open assigned patients and pending confirmations.',
    route: '/patients',
  },
  {
    id: 'risk',
    title: 'Risk dashboard',
    description: 'Run explainable diabetes risk prediction.',
    route: '/risk',
  },
  {
    id: 'appointments',
    title: 'Appointments',
    description: 'Manage availability, slots, and confirmed bookings.',
    route: '/appointments',
  },
  {
    id: 'chatbot',
    title: 'Assistant',
    description: 'Use the clinical assistant workflow.',
    route: '/chatbot',
  },
];

const patientLinks: DashboardLink[] = [
  {
    id: 'assessment',
    title: 'Health form',
    description: 'Update glucose, HbA1c, vitals, and lifestyle details.',
    route: '/assessment',
  },
  {
    id: 'doctor',
    title: 'Choose doctor',
    description: 'Send a request to a doctor from the directory.',
    route: '/psychiatrist',
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Review your saved medical reports.',
    route: '/reports',
  },
  {
    id: 'appointments',
    title: 'Scheduling',
    description: 'Browse available slots and book instantly.',
    route: '/appointments',
  },
  {
    id: 'chatbot',
    title: 'Assistant',
    description: 'Ask questions with your saved profile context.',
    route: '/chatbot',
  },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then((user) => setRole(user?.role ?? null));
  }, []);

  const links = role === 'doctor' ? doctorLinks : patientLinks;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Dashboard" showBack />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-6 pt-4">
          <Card className="mb-6 bg-primary/5 border border-primary/20">
            <Text className="text-lg font-bold text-text mb-1">
              {role === 'doctor' ? 'Doctor dashboard' : 'Patient dashboard'}
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {role === 'doctor'
                ? 'Your routes are tailored to patient oversight, live scheduling, and explainable prediction.'
                : 'Your routes are tailored to profile updates, doctor selection, instant booking, and personal care tracking.'}
            </Text>
          </Card>

          <View className="flex-row flex-wrap justify-between">
            {links.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => router.push(item.route as any)}
                className="w-[48%] mb-4"
                activeOpacity={0.8}
              >
                <Card className="min-h-[148px] border border-border justify-between">
                  <Text className="text-base font-semibold text-text">
                    {item.title}
                  </Text>
                  <Text className="text-sm text-text-secondary leading-5">
                    {item.description}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
