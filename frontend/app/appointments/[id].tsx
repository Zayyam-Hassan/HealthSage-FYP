import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { appointmentsService, type Appointment } from '@/services/appointments';
import { authService, type UserRole } from '@/services/auth';

function getBadgeVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'cancelled':
      return 'error' as const;
    case 'no_show':
      return 'warning' as const;
    default:
      return 'info' as const;
  }
}

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [role, setRole] = useState<UserRole | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAppointment = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      setRole(currentUser?.role ?? null);
      const data = await appointmentsService.getAppointment(id as string);
      setAppointment(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const cancelAppointment = async () => {
    if (!appointment) return;

    try {
      setSaving(true);
      if (role === 'doctor') {
        await appointmentsService.cancelDoctorAppointment(appointment.id);
      } else {
        await appointmentsService.cancelPatientAppointment(appointment.id);
      }
      await loadAppointment();
    } catch (err: any) {
      Alert.alert('Unable to cancel', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const completeAppointment = async () => {
    if (!appointment) return;

    try {
      setSaving(true);
      await appointmentsService.completeDoctorAppointment(appointment.id);
      await loadAppointment();
    } catch (err: any) {
      Alert.alert('Unable to complete', err.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !appointment) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Appointment Details" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  const counterpart =
    role === 'doctor' ? appointment.patient_name : appointment.doctor_name;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Appointment Details" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-6 pt-4">
          <Card className="mb-4 border border-border">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-text">
                {counterpart || 'Appointment'}
              </Text>
              <Badge variant={getBadgeVariant(appointment.status)}>
                {appointment.status.toUpperCase()}
              </Badge>
            </View>
            <Text className="mb-1 text-sm text-text-secondary">
              {appointment.display_date} at {appointment.display_time}
            </Text>
            <Text className="text-base text-text">
              {appointment.reason_for_visit || 'General consultation'}
            </Text>
          </Card>

          <Card className="mb-4 border border-border">
            <Text className="mb-3 text-base font-semibold text-text">
              Booking summary
            </Text>
            <Text className="mb-2 text-sm text-text-secondary">
              Slot status: {appointment.slot?.status || 'unknown'}
            </Text>
            <Text className="mb-2 text-sm text-text-secondary">
              Booked at: {new Date(appointment.booked_at).toLocaleString()}
            </Text>
            {appointment.patient_note ? (
              <Text className="mb-2 text-sm text-text-secondary">
                Patient note: {appointment.patient_note}
              </Text>
            ) : null}
            {appointment.doctor_note ? (
              <Text className="text-sm text-text-secondary">
                Doctor note: {appointment.doctor_note}
              </Text>
            ) : null}
          </Card>

          {appointment.status === 'booked' ? (
            <View className="flex-row">
              <Button
                variant="outline"
                className={role === 'doctor' ? 'mr-2 flex-1' : 'flex-1'}
                onPress={cancelAppointment}
                loading={saving}
              >
                Cancel
              </Button>
              {role === 'doctor' ? (
                <Button className="flex-1" onPress={completeAppointment} loading={saving}>
                  Complete
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
