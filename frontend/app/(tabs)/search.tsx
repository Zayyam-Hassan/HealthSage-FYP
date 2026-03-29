import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Card from '@/components/Card';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { doctorsService } from '@/services/doctors';
import { patientsService } from '@/services/patients';

export default function SearchTabScreen() {
  const router = useRouter();
  const { role, refreshUser, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    patients: 0,
    doctors: 0,
    assignedDoctor: '',
  });

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        setLoading(true);
        const currentUser = await refreshUser();
        const currentRole = currentUser?.role ?? null;

        if (currentRole === 'doctor') {
          const patients = await doctorsService.getMyPatients();
          setSummary({ patients: patients.items.length, doctors: 0, assignedDoctor: '' });
        } else {
          const [doctors, patient] = await Promise.all([
            doctorsService.getDoctors({ limit: 50 }),
            patientsService.getMyPatientProfile().catch(() => null),
          ]);
          setSummary({
            patients: 0,
            doctors: doctors.items.length,
            assignedDoctor: patient?.assignment.doctor?.name || '',
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, refreshUser]);

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  const tiles =
    role === 'doctor'
      ? [
          {
            id: 'patients',
            title: `${summary.patients} active patients`,
            body: 'Open the patient panel to review assignments and linked scheduling activity.',
            route: '/patients',
          },
          {
            id: 'risk',
            title: 'Prediction tools',
            body: 'Run risk prediction with the simplified dashboard.',
            route: '/risk',
          },
        ]
      : [
          {
            id: 'doctor',
            title: summary.assignedDoctor || `${summary.doctors} doctors available`,
            body: summary.assignedDoctor
              ? 'Your doctor is linked. Open scheduling to book a live slot.'
              : 'Browse the directory and request a doctor.',
            route: '/psychiatrist',
          },
          {
            id: 'assessment',
            title: 'Health form',
            body: 'Update the fields used by the prediction model.',
            route: '/assessment',
          },
        ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          <Card className="mb-6 bg-bg-secondary border-primary/12 shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
              {role === 'doctor' ? 'Workspace' : 'Care'}
            </Text>
            <Text className="text-2xl font-bold text-text mb-2 tracking-tight">
              {role === 'doctor' ? 'Clinical hub' : 'Care hub'}
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
              {role === 'doctor'
                ? 'Patient list, assignments, and prediction tools.'
                : 'Your doctor, health form, and care pathways.'}
            </Text>
          </Card>

          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              activeOpacity={0.85}
              onPress={() => router.push(tile.route as any)}
              accessibilityRole="button"
              accessibilityLabel={`${tile.title}. ${tile.body}`}
            >
              <Card className="mb-4 border-border/80 bg-bg-card">
                <Text className="text-lg font-semibold text-text mb-1 tracking-tight">{tile.title}</Text>
                <Text className="text-sm text-text-secondary leading-6">{tile.body}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
