import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
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
          <Card className="mb-6 bg-bg-secondary border-primary/12 shadow-sm">
            <View className="items-center">
              <Avatar size="xl" name={user?.display_name || 'User'} className="mb-4" />
              <Text className="text-2xl font-bold text-text mb-1 tracking-tight">
                {user?.display_name || 'User'}
              </Text>
              <Text className="text-sm text-text-secondary mb-1">{user?.email}</Text>
              <View className="mt-1 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/15">
                <Text className="text-sm font-semibold text-primary">
                  {meta.roleLabel || user?.role || 'User'}
                </Text>
              </View>
              <Text className="text-sm text-text-secondary mt-3 text-center leading-5">
                {meta.subtitle}
              </Text>
              <Text className="text-xs text-text-tertiary mt-1 text-center">{meta.detail}</Text>
            </View>
          </Card>

          <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
            Account
          </Text>
          {[
            { id: 'edit', title: 'Edit profile', route: '/settings/edit-profile' },
            { id: 'password', title: 'Change password', route: '/settings/change-password' },
            { id: 'reports', title: 'Reports', route: '/reports' },
            { id: 'help', title: 'Help and support', route: '/help-support' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Card className="mb-3 py-3.5 border-border/80">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-text leading-6">{item.title}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                </View>
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
