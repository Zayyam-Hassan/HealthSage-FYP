import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { appointmentsService } from '@/services/appointments';
import { authService, type UserRole } from '@/services/auth';
import { doctorsService, type Doctor } from '@/services/doctors';
import { patientsService } from '@/services/patients';

const timeSlots = ['09:00', '11:00', '14:00', '16:00'];

function buildDateOptions() {
  const options: { label: string; value: string }[] = [];
  const today = new Date();
  for (let offset = 0; offset < 10; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    options.push({
      label: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      value: date.toISOString().split('T')[0],
    });
  }
  return options;
}

export default function BookAppointmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [role, setRole] = useState<UserRole | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState((params.doctor_id as string) || '');
  const [selectedPatientId, setSelectedPatientId] = useState((params.patient_id as string) || '');
  const [activeDate, setActiveDate] = useState('');
  const [activeTime, setActiveTime] = useState('');
  const [reason, setReason] = useState('');
  const [proposedSlots, setProposedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  }>({ visible: false, title: '', message: '' });

  const dateOptions = useMemo(() => buildDateOptions(), []);

  const loadBookingOptions = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      const currentRole = currentUser?.role ?? null;
      setRole(currentRole);

      if (currentRole !== 'patient') {
        setDoctors([]);
        setDoctor(null);
        setSelectedDoctorId('');
        setSelectedPatientId('');
        return;
      }

      const patientProfile = await patientsService.getMyPatientProfile();
      const assignedDoctorId =
        (params.doctor_id as string) || patientProfile.assignment.doctor?.id || '';

      setSelectedPatientId(patientProfile.id);

      if (!assignedDoctorId) {
        setDoctors([]);
        setDoctor(null);
        setSelectedDoctorId('');
        return;
      }

      const doctorProfile = await doctorsService.getDoctor(assignedDoctorId);
      setDoctors([doctorProfile]);
      setDoctor(doctorProfile);
      setSelectedDoctorId(doctorProfile.id);
    } catch (error) {
      console.error('Failed to load appointment screen:', error);
    } finally {
      setLoading(false);
    }
  }, [params.doctor_id]);

  useEffect(() => {
    loadBookingOptions();
  }, [loadBookingOptions]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    doctorsService.getDoctor(selectedDoctorId).then(setDoctor).catch(() => null);
  }, [selectedDoctorId]);

  const addSlot = () => {
    if (!activeDate || !activeTime) {
      setDialog({
        visible: true,
        title: 'Choose a date and time',
        message: 'Pick a day and a time before adding a slot.',
      });
      return;
    }
    const slot = new Date(`${activeDate}T${activeTime}:00`).toISOString();
    if (proposedSlots.includes(slot)) {
      setDialog({
        visible: true,
        title: 'Slot already added',
        message: 'Choose a different option.',
      });
      return;
    }
    if (proposedSlots.length >= 3) {
      setDialog({
        visible: true,
        title: 'Maximum reached',
        message: 'Please keep the request to three proposed slots.',
      });
      return;
    }
    setProposedSlots([...proposedSlots, slot]);
  };

  const removeSlot = (slot: string) => {
    setProposedSlots(proposedSlots.filter((item) => item !== slot));
  };

  const submitRequest = async () => {
    if (!selectedDoctorId || !selectedPatientId || !reason.trim() || proposedSlots.length === 0) {
      setDialog({
        visible: true,
        title: 'Incomplete request',
        message: 'Select a doctor, patient, reason, and up to three slots.',
      });
      return;
    }

    try {
      setSaving(true);
      await appointmentsService.createAppointment({
        doctor_id: selectedDoctorId,
        patient_id: selectedPatientId,
        proposed_slots: proposedSlots,
        requested_by_role: 'patient',
        reason: reason.trim(),
      });
      setDialog({
        visible: true,
        title: 'Appointment request sent',
        message: 'The other side can now review and confirm one of your proposed times.',
        actions: [{ label: 'Back to appointments', onPress: () => router.back() }],
      });
    } catch (error: any) {
      setDialog({
        visible: true,
        title: 'Unable to send request',
        message: error.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Appointment Request" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (role !== 'patient') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Appointment Request" showBack />
        <View className="flex-1 justify-center px-6">
          <Card>
            <Text className="text-lg font-semibold text-text mb-2">
              Patient-only request flow
            </Text>
            <Text className="text-sm text-text-secondary leading-6 mb-4">
              Patients send appointment requests. Doctors respond from the appointments inbox.
            </Text>
            <Button fullWidth onPress={() => router.replace('/appointments' as any)}>
              Back to appointments
            </Button>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedDoctorId || !doctor) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Appointment Request" showBack />
        <View className="flex-1 justify-center px-6">
          <Card>
            <Text className="text-lg font-semibold text-text mb-2">
              Choose your doctor first
            </Text>
            <Text className="text-sm text-text-secondary leading-6 mb-4">
              Appointment requests are sent to your assigned doctor. Please choose and confirm a doctor before booking.
            </Text>
            <Button fullWidth onPress={() => router.replace('/psychiatrist' as any)}>
              Open doctor directory
            </Button>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={() => setDialog((current) => ({ ...current, visible: false }))}
      />
      <Header title="Appointment Request" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          {doctor && (
            <Card className="mb-4">
              <View className="flex-row items-center">
                <Avatar name={doctor.name} size="lg" className="mr-4" />
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-text mb-1">
                    {doctor.name}
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    {doctor.specialization}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {doctors.length > 0 && (
            <Card className="mb-4">
              <Text className="text-base font-semibold text-text mb-3">Doctor</Text>
              <Text className="text-sm text-text-secondary mb-3">
                Appointments are limited to your assigned doctor.
              </Text>
              <View className="flex-row flex-wrap">
                {doctors.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedDoctorId(item.id)}
                    className={`mr-2 mb-2 px-4 py-3 rounded-xl border-2 ${
                      selectedDoctorId === item.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        selectedDoctorId === item.id ? 'text-primary' : 'text-text'
                      }`}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          )}

          <Card className="mb-4">
            <Text className="text-base font-semibold text-text mb-3">Choose dates</Text>
            <View className="flex-row flex-wrap">
              {dateOptions.map((date) => (
                <TouchableOpacity
                  key={date.value}
                  onPress={() => setActiveDate(date.value)}
                  className={`mr-2 mb-2 px-4 py-3 rounded-xl border-2 ${
                    activeDate === date.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      activeDate === date.value ? 'text-primary' : 'text-text'
                    }`}
                  >
                    {date.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-base font-semibold text-text mt-3 mb-3">Choose time</Text>
            <View className="flex-row flex-wrap">
              {timeSlots.map((time) => (
                <TouchableOpacity
                  key={time}
                  onPress={() => setActiveTime(time)}
                  className={`mr-2 mb-2 px-4 py-3 rounded-xl border-2 ${
                    activeTime === time
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      activeTime === time ? 'text-primary' : 'text-text'
                    }`}
                  >
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button variant="outline" onPress={addSlot} fullWidth className="mt-3">
              Add slot
            </Button>
          </Card>

          <Card className="mb-4">
            <Text className="text-base font-semibold text-text mb-3">Proposed times</Text>
            {proposedSlots.length > 0 ? (
              proposedSlots.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  onPress={() => removeSlot(slot)}
                  className="mb-2 p-4 rounded-xl border border-border bg-background"
                >
                  <Text className="text-sm font-semibold text-text">
                    {new Date(slot).toLocaleString()}
                  </Text>
                  <Text className="text-xs text-text-secondary mt-1">
                    Tap to remove
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text className="text-sm text-text-secondary">
                Add two or three time options to send a proper request.
              </Text>
            )}
          </Card>

          <Card className="mb-5">
            <Text className="text-base font-semibold text-text mb-3">
              Reason for appointment
            </Text>
            <TextInput
              className="text-base text-text min-h-[120px]"
              placeholder="Describe what you need help with"
              placeholderTextColor="#9CA3AF"
              value={reason}
              onChangeText={setReason}
              multiline
              textAlignVertical="top"
            />
          </Card>

          <Button onPress={submitRequest} loading={saving} fullWidth>
            Send appointment request
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
