import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Card from '@/components/Card';
import Loader from '@/components/Loader';
import { authService, type UserRole } from '@/services/auth';
import { doctorsService } from '@/services/doctors';
import { patientsService } from '@/services/patients';

export default function SearchTabScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    patients: 0,
    doctors: 0,
    assignedDoctor: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        const currentRole = currentUser?.role ?? null;
        setRole(currentRole);

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
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
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
          <Card className="mb-5 bg-primary/5 border border-primary/20">
            <Text className="text-2xl font-bold text-text mb-2">
              {role === 'doctor' ? 'Clinical hub' : 'Care hub'}
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {role === 'doctor'
                ? 'A focused place for patient review and risk work.'
                : 'A focused place for doctor selection and profile updates.'}
            </Text>
          </Card>

          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              activeOpacity={0.85}
              onPress={() => router.push(tile.route as any)}
            >
              <Card className="mb-4 border border-border">
                <Text className="text-lg font-semibold text-text mb-1">
                  {tile.title}
                </Text>
                <Text className="text-sm text-text-secondary leading-5">
                  {tile.body}
                </Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
