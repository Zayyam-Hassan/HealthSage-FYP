import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Header from '@/components/Header';
import Loader from '@/components/Loader';

export default function BookAppointmentRedirectScreen() {
  const params = useLocalSearchParams<Record<string, string>>();

  useEffect(() => {
    router.replace({
      pathname: '/appointments',
      params,
    });
  }, [params]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Scheduling" showBack />
      <View className="flex-1 items-center justify-center">
        <Loader />
      </View>
    </SafeAreaView>
  );
}
