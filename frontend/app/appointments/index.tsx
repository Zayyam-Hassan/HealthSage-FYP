import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AppointmentCard from '@/components/Card/AppointmentCard';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { appointmentsService, type Appointment } from '@/services/appointments';
import { authService, type UserRole } from '@/services/auth';

export default function AppointmentsScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = async () => {
    try {
      setError(null);
      const currentUser = await authService.getCurrentUser();
      setRole(currentUser?.role ?? null);
      const response = await appointmentsService.getAppointments({
        page: 1,
        limit: 100,
      });
      setAppointments(response.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadAppointments();
    }, []),
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header
          title="Appointments"
          showBack
          rightActions={
            role === 'patient' ? (
              <Button variant="text" size="sm" onPress={() => router.push('/appointments/book' as any)}>
                New
              </Button>
            ) : undefined
          }
        />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header
        title="Appointments"
        showBack
        rightActions={
          role === 'patient' ? (
            <Button variant="text" size="sm" onPress={() => router.push('/appointments/book' as any)}>
              New
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <View className="mx-6 mt-4 p-4 bg-error/10 rounded-lg">
          <Text className="text-error text-sm">{error}</Text>
        </View>
      ) : null}
      {appointments.length > 0 ? (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-6">
              <AppointmentCard
                date={item.display_date || 'Pending slot'}
                time={item.display_time || item.status}
                doctorName={item.counterpart_name || 'Appointment request'}
                specialty={item.reason}
                status={
                  item.status === 'completed'
                    ? 'completed'
                    : item.status === 'rejected' || item.status === 'cancelled'
                      ? 'cancelled'
                      : 'upcoming'
                }
                onPress={() => router.push(`/appointments/${item.id}` as any)}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              loadAppointments();
            }} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState
          title="No appointments yet"
          message={
            role === 'patient'
              ? 'Send a request with multiple possible times to get started.'
              : 'Patient appointment requests will appear here for review.'
          }
          actionLabel={role === 'patient' ? 'Create request' : undefined}
          onActionPress={role === 'patient' ? () => router.push('/appointments/book' as any) : undefined}
        />
      )}
    </SafeAreaView>
  );
}
