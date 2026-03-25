import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { authService, type AuthUser } from '@/services/auth';
import { doctorsService } from '@/services/doctors';
import { patientsService } from '@/services/patients';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);

      if (currentUser?.role === 'doctor') {
        const doctor = await doctorsService.getDoctorMe();
        setMeta({
          roleLabel: 'Doctor',
          subtitle: doctor.specialization,
          detail: `${doctor.stats?.patient_count ?? 0} assigned patients`,
        });
      } else if (currentUser?.role === 'patient') {
        const patient = await patientsService.getMyPatientProfile();
        setMeta({
          roleLabel: 'Patient',
          subtitle: patient.assignment.doctor
            ? `Doctor: ${patient.assignment.doctor.name}`
            : 'No doctor assigned yet',
          detail: `Patient ID: ${patient.patient_id}`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, []),
  );

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Header title="Profile" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-6 pt-6">
          <Card className="mb-5 bg-primary/5 border border-primary/20">
            <View className="items-center">
              <Avatar size="xl" name={user?.display_name || 'User'} className="mb-4" />
              <Text className="text-2xl font-bold text-text mb-1">
                {user?.display_name || 'User'}
              </Text>
              <Text className="text-sm text-text-secondary mb-1">
                {user?.email}
              </Text>
              <Text className="text-sm text-primary font-semibold">
                {meta.roleLabel || user?.role || 'User'}
              </Text>
              <Text className="text-sm text-text-secondary mt-2">
                {meta.subtitle}
              </Text>
              <Text className="text-xs text-text-tertiary mt-1">{meta.detail}</Text>
            </View>
          </Card>

          {[
            { id: 'edit', title: 'Edit profile', route: '/settings/edit-profile' },
            { id: 'password', title: 'Change password', route: '/settings/change-password' },
            { id: 'reports', title: 'Reports', route: '/reports' },
            { id: 'help', title: 'Help and support', route: '/help-support' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <Card className="mb-3 border border-border">
                <Text className="text-base font-semibold text-text">{item.title}</Text>
              </Card>
            </TouchableOpacity>
          ))}

          <Button variant="outline" fullWidth className="mt-4" onPress={handleLogout}>
            Logout
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
