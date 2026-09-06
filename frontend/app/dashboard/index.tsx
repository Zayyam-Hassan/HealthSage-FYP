import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Card from '@/components/Card';
import Header from '@/components/Header';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

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
  const { role } = useAuth();

  const links = role === 'doctor' ? doctorLinks : patientLinks;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header
        variant="coral"
        title="Dashboard"
        showBack
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-6 pt-6">
          <Card className="mb-6 bg-bg-secondary border-primary/12 shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
              Overview
            </Text>
            <Text className="text-2xl font-bold text-text mb-2 tracking-tight">
              {role === 'doctor' ? 'Doctor dashboard' : 'Patient dashboard'}
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
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
                <Card className="min-h-[152px] border-border/80 justify-between bg-bg-card">
                  <Text className="text-base font-semibold text-text tracking-tight">
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
