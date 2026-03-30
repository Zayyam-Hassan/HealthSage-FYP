import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';

export default function BookAppointmentRedirectScreen() {
  const params = useLocalSearchParams<Record<string, string>>();

  useEffect(() => {
    if (params.doctor_id) {
      router.replace(`/appointments/doctor/${params.doctor_id}` as never);
    } else {
      router.replace({ pathname: '/appointments', params: {} });
    }
  }, [params]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Scheduling" showBack />
      <CenteredScreenLoader />
    </SafeAreaView>
  );
}
