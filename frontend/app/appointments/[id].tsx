import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { appointmentsService, type Appointment } from '@/services/appointments';
import { authService, type UserRole } from '@/services/auth';

export default function AppointmentDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [role, setRole] = useState<UserRole | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  }>({ visible: false, title: '', message: '' });

  const loadAppointment = useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await authService.getCurrentUser();
      setRole(currentUser?.role ?? null);
      const data = await appointmentsService.getAppointment(id as string);
      setAppointment(data);
      setSelectedSlot(data.scheduled_at ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const acceptSelectedSlot = async () => {
    if (!appointment || !selectedSlot) {
      setDialog({
        visible: true,
        title: 'Select a time',
        message: 'Choose one proposed time before accepting.',
      });
      return;
    }

    setDialog({
      visible: true,
      title: 'Accept appointment',
      message: `Confirm ${new Date(selectedSlot).toLocaleString()} as the appointment time?`,
      actions: [
        { label: 'No', onPress: () => {}, variant: 'secondary' },
        {
          label: 'Yes, accept',
          onPress: async () => {
            try {
              await appointmentsService.updateAppointment(appointment.id, {
                selected_slot: selectedSlot,
              });
              setDialog({
                visible: true,
                title: 'Appointment confirmed',
                message: 'The selected time has been confirmed.',
              });
              await loadAppointment();
            } catch (error: any) {
              setDialog({
                visible: true,
                title: 'Unable to confirm',
                message: error.message || 'Please try again.',
              });
            }
          },
        },
      ],
    });
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

  const canRespond =
    appointment.status === 'pending' &&
    appointment.requested_by_role !== role;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={() => setDialog((current) => ({ ...current, visible: false }))}
      />
      <Header title="Appointment Details" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <Card className="mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-text">
                {appointment.counterpart_name || 'Appointment request'}
              </Text>
              <Badge variant={appointment.status === 'confirmed' ? 'success' : 'warning'}>
                {appointment.status.toUpperCase()}
              </Badge>
            </View>
            <Text className="text-sm text-text-secondary mb-2">
              Requested by {appointment.requested_by_role}
            </Text>
            <Text className="text-base text-text">{appointment.reason}</Text>
          </Card>

          <Card className="mb-4">
            <Text className="text-base font-semibold text-text mb-3">
              Proposed slots
            </Text>
            {appointment.proposed_slots.map((slot) => (
              <TouchableOpacity
                key={slot}
                disabled={!canRespond}
                onPress={() => setSelectedSlot(slot)}
                className={`mb-3 p-4 rounded-xl border ${
                  (appointment.scheduled_at || selectedSlot) === slot
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background'
                }`}
              >
                <Text className="text-sm font-semibold text-text">
                  {new Date(slot).toLocaleString()}
                </Text>
                {canRespond ? (
                  <Text className="text-xs text-primary mt-1">
                    Tap to select this slot
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </Card>

          {appointment.scheduled_at ? (
            <Card className="mb-4 bg-primary/5 border border-primary/20">
              <Text className="text-base font-semibold text-text mb-1">
                Confirmed appointment
              </Text>
              <Text className="text-sm text-text-secondary">
                {new Date(appointment.scheduled_at).toLocaleString()}
              </Text>
            </Card>
          ) : null}

          <View className="flex-row">
            <Button
              variant="outline"
              className="flex-1 mr-2"
              onPress={() =>
                setDialog({
                  visible: true,
                  title: 'Cancel appointment',
                  message: 'Do you want to cancel this appointment?',
                  actions: [
                    { label: 'No', onPress: () => {}, variant: 'secondary' },
                    {
                      label: 'Yes, cancel',
                      variant: 'danger',
                      onPress: async () => {
                        await appointmentsService.updateAppointment(appointment.id, {
                          status: 'cancelled',
                        });
                        await loadAppointment();
                      },
                    },
                  ],
                })
              }
            >
              Cancel
            </Button>
            {canRespond ? (
              <Button
                className="flex-1"
                onPress={acceptSelectedSlot}
              >
                Accept
              </Button>
            ) : null}
          </View>

          {canRespond ? (
            <View className="mt-3">
              <Button
                variant="outline"
                fullWidth
                onPress={() =>
                  setDialog({
                    visible: true,
                    title: 'Reject appointment',
                    message: 'Do you want to reject this appointment request?',
                    actions: [
                      { label: 'No', onPress: () => {}, variant: 'secondary' },
                      {
                        label: 'Yes, reject',
                        variant: 'danger',
                        onPress: async () => {
                          await appointmentsService.updateAppointment(appointment.id, {
                            status: 'rejected',
                          });
                          await loadAppointment();
                        },
                      },
                    ],
                  })
                }
              >
                Reject request
              </Button>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
