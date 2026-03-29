import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import AppDialog from '@/components/AppDialog';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import Select from '@/components/Select';
import {
  appointmentsService,
  type Appointment,
  type AppointmentSlot,
  type Availability,
  type SchedulingWeekday,
} from '@/services/appointments';
import { authService, type UserRole } from '@/services/auth';
import { doctorsService, type Doctor } from '@/services/doctors';
import { patientsService } from '@/services/patients';
import { colors } from '@/constants/colors';

const weekdays: { label: string; value: SchedulingWeekday }[] = [
  { label: 'Sun', value: 'sunday' },
  { label: 'Mon', value: 'monday' },
  { label: 'Tue', value: 'tuesday' },
  { label: 'Wed', value: 'wednesday' },
  { label: 'Thu', value: 'thursday' },
  { label: 'Fri', value: 'friday' },
  { label: 'Sat', value: 'saturday' },
];

const slotDurationOptions = ['15', '20', '30', '45', '60'];
const timePickerFields = {
  start_time: 'Start time',
  end_time: 'End time',
  break_start_time: 'Break start',
  break_end_time: 'Break end',
} as const;

function buildTimeOptions(stepMinutes = 15) {
  return Array.from({ length: (24 * 60) / stepMinutes }, (_, index) => {
    const totalMinutes = index * stepMinutes;
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
}

function timeValueToDate(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function dateToTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

const allTimeOptions = buildTimeOptions();

function getBadgeVariant(status: string) {
  switch (status) {
    case 'available':
    case 'completed':
      return 'success' as const;
    case 'blocked':
    case 'no_show':
      return 'warning' as const;
    case 'cancelled':
      return 'error' as const;
    default:
      return 'info' as const;
  }
}

function emptyAvailabilityForm() {
  return {
    weekday: 'monday' as SchedulingWeekday,
    start_time: '09:00',
    end_time: '13:00',
    slot_duration_minutes: '30',
    break_start_time: '',
    break_end_time: '',
  };
}

function TimeField({
  label,
  value,
  helperText,
  onPress,
  onClear,
}: {
  label: string;
  value: string;
  helperText: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-text">{label}</Text>
        {onClear ? (
          <Button variant="text" size="sm" onPress={onClear}>
            Clear
          </Button>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onPress}
        className="rounded-2xl border border-border/90 bg-bg-card px-4 py-4 min-h-[52px] justify-center"
      >
        <Text className="text-base font-semibold text-text">
          {value || 'Select time'}
        </Text>
        <Text className="mt-1 text-sm text-text-secondary">{helperText}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ doctor_id?: string }>();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availabilityForm, setAvailabilityForm] = useState(emptyAvailabilityForm);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [doctorSlots, setDoctorSlots] = useState<AppointmentSlot[]>([]);
  const [doctorAppointments, setDoctorAppointments] = useState<Appointment[]>([]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');
  const [patientSlots, setPatientSlots] = useState<AppointmentSlot[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [selectedSlotDate, setSelectedSlotDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [patientNote, setPatientNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timePicker, setTimePicker] = useState<{
    visible: boolean;
    field: 'start_time' | 'end_time' | 'break_start_time' | 'break_end_time' | null;
  }>({ visible: false, field: null });
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  }>({ visible: false, title: '', message: '' });

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null,
    [doctors, selectedDoctorId],
  );

  const slotDates = useMemo(
    () => [...new Set(patientSlots.map((slot) => slot.slot_date))],
    [patientSlots],
  );

  const visiblePatientSlots = useMemo(
    () =>
      patientSlots.filter((slot) =>
        selectedSlotDate ? slot.slot_date === selectedSlotDate : true,
      ),
    [patientSlots, selectedSlotDate],
  );

  const openTimePicker = (
    field: 'start_time' | 'end_time' | 'break_start_time' | 'break_end_time',
  ) => {
    setTimePicker({ visible: true, field });
  };

  const handleNativeTimePicked = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setTimePicker((current) => ({ ...current, visible: false }));
    }

    const field = timePicker.field;
    if (event.type === 'dismissed' || !selectedDate || !field) {
      return;
    }

    const value = dateToTimeValue(selectedDate);
    setAvailabilityForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const applyPickedTime = (value: string) => {
    const field = timePicker.field;
    if (!field) return;

    setAvailabilityForm((current) => ({
      ...current,
      [field]: value,
    }));
    setTimePicker({ visible: false, field: null });
  };

  const loadDoctorData = useCallback(async () => {
    const [availabilityRes, slotsRes, appointmentsRes] = await Promise.all([
      appointmentsService.getDoctorAvailability(),
      appointmentsService.getDoctorSlots({ days_ahead: 14 }),
      appointmentsService.getDoctorAppointments({ limit: 50 }),
    ]);

    setAvailability(availabilityRes.items);
    setDoctorSlots(slotsRes.items);
    setDoctorAppointments(appointmentsRes.items);
  }, []);

  const loadPatientData = useCallback(
    async (currentSelectedDoctorId?: string) => {
      const [doctorsRes, profile, appointmentsRes] = await Promise.all([
        doctorsService.getDoctors({ limit: 50 }),
        patientsService.getMyPatientProfile().catch(() => null),
        appointmentsService.getPatientAppointments({ limit: 50 }),
      ]);

      const preferredDoctorId =
        currentSelectedDoctorId ||
        params.doctor_id ||
        selectedDoctorId ||
        profile?.assignment.doctor?.id ||
        doctorsRes.items[0]?.id ||
        '';

      setDoctors(doctorsRes.items);
      setAssignedDoctorId(profile?.assignment.doctor?.id || '');
      setSelectedDoctorId(preferredDoctorId);
      setPatientAppointments(appointmentsRes.items);

      if (preferredDoctorId) {
        const slotsRes = await appointmentsService.getDoctorPublicSlots(
          preferredDoctorId,
          { days_ahead: 14 },
        );
        setPatientSlots(slotsRes.items);
      } else {
        setPatientSlots([]);
      }
    },
    [params.doctor_id, selectedDoctorId],
  );

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const currentUser = await authService.getCurrentUser();
      const currentRole = currentUser?.role ?? null;
      setRole(currentRole);

      if (currentRole === 'doctor') {
        await loadDoctorData();
      } else if (currentRole === 'patient') {
        await loadPatientData();
      } else {
        setAvailability([]);
        setDoctorSlots([]);
        setDoctorAppointments([]);
        setDoctors([]);
        setPatientSlots([]);
        setPatientAppointments([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduling');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadDoctorData, loadPatientData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (role !== 'patient' || !selectedDoctorId) return;

    appointmentsService
      .getDoctorPublicSlots(selectedDoctorId, { days_ahead: 14 })
      .then((response) => setPatientSlots(response.items))
      .catch((err: any) =>
        setError(err.message || 'Failed to load doctor availability'),
      );
  }, [role, selectedDoctorId]);

  useEffect(() => {
    if (slotDates.length === 0) {
      setSelectedSlotDate('');
      return;
    }

    setSelectedSlotDate((current) =>
      current && slotDates.includes(current) ? current : slotDates[0],
    );
  }, [slotDates]);

  const openDialog = (
    title: string,
    message: string,
    actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }[],
  ) => {
    setDialog({
      visible: true,
      title,
      message,
      actions,
    });
  };

  const activePickerValue = timePicker.field
    ? availabilityForm[timePicker.field] || ''
    : '';

  const resetAvailabilityForm = () => {
    setAvailabilityForm(emptyAvailabilityForm());
    setEditingAvailabilityId(null);
  };

  const submitAvailability = async () => {
    const slotDuration = Number(availabilityForm.slot_duration_minutes);

    if (!Number.isFinite(slotDuration)) {
      openDialog('Invalid duration', 'Please choose a valid slot duration.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        weekday: availabilityForm.weekday,
        start_time: availabilityForm.start_time.trim(),
        end_time: availabilityForm.end_time.trim(),
        slot_duration_minutes: slotDuration,
        break_start_time: availabilityForm.break_start_time.trim() || null,
        break_end_time: availabilityForm.break_end_time.trim() || null,
        is_active: true,
      };

      if (editingAvailabilityId) {
        await appointmentsService.updateDoctorAvailability(editingAvailabilityId, payload);
      } else {
        await appointmentsService.createDoctorAvailability(payload);
      }

      await appointmentsService.generateDoctorSlots({ days_ahead: 14 });
      resetAvailabilityForm();
      await loadDoctorData();
    } catch (err: any) {
      openDialog('Unable to save availability', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateSlots = async () => {
    try {
      setSubmitting(true);
      const response = await appointmentsService.generateDoctorSlots({ days_ahead: 14 });
      await loadDoctorData();
      openDialog(
        'Slots generated',
        `${response.generated_count} new slots are ready. ${response.skipped_count} existing slots were kept.`,
      );
    } catch (err: any) {
      openDialog('Unable to generate slots', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const editAvailability = (item: Availability) => {
    setEditingAvailabilityId(item.id);
    setAvailabilityForm({
      weekday: item.weekday,
      start_time: item.start_time,
      end_time: item.end_time,
      slot_duration_minutes: String(item.slot_duration_minutes),
      break_start_time: item.break_start_time || '',
      break_end_time: item.break_end_time || '',
    });
  };

  const deleteAvailability = (availabilityId: string) => {
    openDialog('Delete availability', 'This removes future open slots from this window.', [
      { label: 'Keep', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Delete',
        variant: 'danger',
        onPress: async () => {
          try {
            await appointmentsService.deleteDoctorAvailability(availabilityId);
            await loadDoctorData();
            if (editingAvailabilityId === availabilityId) {
              resetAvailabilityForm();
            }
          } catch (err: any) {
            openDialog('Unable to delete', err.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const blockSlot = (slotId: string) => {
    openDialog('Block slot', 'This slot will no longer be bookable.', [
      { label: 'Keep open', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Block',
        variant: 'danger',
        onPress: async () => {
          try {
            await appointmentsService.blockDoctorSlot(slotId);
            await loadDoctorData();
          } catch (err: any) {
            openDialog('Unable to block slot', err.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const cancelDoctorAppointment = (appointmentId: string) => {
    openDialog('Cancel appointment', 'This confirmed appointment will be cancelled.', [
      { label: 'Keep', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Cancel appointment',
        variant: 'danger',
        onPress: async () => {
          try {
            await appointmentsService.cancelDoctorAppointment(appointmentId);
            await loadDoctorData();
          } catch (err: any) {
            openDialog('Unable to cancel', err.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const completeDoctorAppointment = (appointmentId: string) => {
    openDialog('Complete appointment', 'Mark this appointment as completed?', [
      { label: 'Not yet', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Complete',
        onPress: async () => {
          try {
            await appointmentsService.completeDoctorAppointment(appointmentId);
            await loadDoctorData();
          } catch (err: any) {
            openDialog('Unable to complete', err.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const bookAppointment = async () => {
    if (!selectedSlotId) {
      openDialog('Choose a slot', 'Select one available slot before booking.');
      return;
    }

    try {
      setSubmitting(true);
      await appointmentsService.createPatientAppointment({
        slot_id: selectedSlotId,
        reason_for_visit: reasonForVisit.trim() || undefined,
        patient_note: patientNote.trim() || undefined,
      });
      setSelectedSlotId('');
      setReasonForVisit('');
      setPatientNote('');
      await loadPatientData(selectedDoctorId);
      openDialog(
        'Appointment confirmed',
        'Your slot has been booked instantly and now appears in your appointments list.',
      );
    } catch (err: any) {
      openDialog('Unable to book slot', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPatientAppointment = (appointmentId: string) => {
    openDialog('Cancel booking', 'This upcoming booking will be cancelled.', [
      { label: 'Keep booking', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Cancel booking',
        variant: 'danger',
        onPress: async () => {
          try {
            await appointmentsService.cancelPatientAppointment(appointmentId);
            await loadPatientData(selectedDoctorId);
          } catch (err: any) {
            openDialog('Unable to cancel', err.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Scheduling" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={() => setDialog((current) => ({ ...current, visible: false }))}
      />
      <Modal
        visible={Platform.OS === 'web' && timePicker.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePicker({ visible: false, field: null })}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-6">
          <View className="max-h-[80%] w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-text">
                  {timePicker.field ? timePickerFields[timePicker.field] : 'Select time'}
                </Text>
                <Text className="mt-1 text-sm text-text-secondary">
                  Choose the time you want for this availability window.
                </Text>
              </View>
              <Button
                variant="text"
                size="sm"
                onPress={() => setTimePicker({ visible: false, field: null })}
              >
                Close
              </Button>
            </View>

            {timePicker.field?.startsWith('break_') ? (
              <Button
                variant="outline"
                fullWidth
                className="mb-3"
                onPress={() => {
                  applyPickedTime('');
                }}
              >
                No break
              </Button>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap justify-between">
                {allTimeOptions.map((time) => (
                  <TouchableOpacity
                    key={time}
                    onPress={() => applyPickedTime(time)}
                    className={`mb-2 w-[31%] rounded-xl border px-3 py-3 ${
                      activePickerValue === time
                        ? 'border-coral-deep bg-coral-soft'
                        : 'border-border bg-background'
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        activePickerValue === time ? 'text-coral-ink' : 'text-text'
                      }`}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Header title="Scheduling" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.coral.main}
            colors={[colors.coral.main]}
          />
        }
      >
        <View className="px-6 pt-4">
          {error ? (
            <View className="mb-4 rounded-xl bg-error/10 p-4">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          ) : null}

          {role === 'doctor' ? (
            <>
              <Card className="mb-4 bg-surface-soft border-coral-soft shadow-sm">
                <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-1">
                  Clinician
                </Text>
                <Text className="mb-1 text-lg font-semibold text-text leading-6">Automated scheduling</Text>
                <Text className="text-sm leading-6 text-text-secondary">
                  Set weekly hours, generate slots, and confirm patient bookings instantly.
                </Text>
              </Card>

              <Card className="mb-4 border-border/90">
                <Text className="mb-3 text-base font-semibold text-text">
                  {editingAvailabilityId ? 'Update availability' : 'Weekly availability'}
                </Text>

                <View className="mb-3 flex-row flex-wrap">
                  {weekdays.map((day) => (
                    <TouchableOpacity
                      key={day.value}
                      onPress={() =>
                        setAvailabilityForm((current) => ({
                          ...current,
                          weekday: day.value,
                        }))
                      }
                      className={`mb-2 mr-2 rounded-xl border px-4 py-3 ${
                        availabilityForm.weekday === day.value
? 'border-coral-deep bg-coral-soft'
                            : 'border-border bg-background'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          availabilityForm.weekday === day.value
                            ? 'text-coral-ink'
                            : 'text-text'
                        }`}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TimeField
                  label="Start time"
                  value={availabilityForm.start_time}
                  helperText="Open the same picker used across web and mobile."
                  onPress={() => openTimePicker('start_time')}
                />

                <TimeField
                  label="End time"
                  value={availabilityForm.end_time}
                  helperText="Open the same picker used across web and mobile."
                  onPress={() => openTimePicker('end_time')}
                />

                <Select
                  label="Slot duration"
                  value={availabilityForm.slot_duration_minutes}
                  options={slotDurationOptions}
                  onSelect={(value) =>
                    setAvailabilityForm((current) => ({
                      ...current,
                      slot_duration_minutes: value,
                    }))
                  }
                  helperText="Minutes per consultation."
                />

                <TimeField
                  label="Break start"
                  value={availabilityForm.break_start_time || 'No break'}
                  helperText="Optional. Leave empty if you do not need a break."
                  onPress={() => openTimePicker('break_start_time')}
                  onClear={() =>
                    setAvailabilityForm((current) => ({
                      ...current,
                      break_start_time: '',
                      break_end_time: '',
                    }))
                  }
                />

                <TimeField
                  label="Break end"
                  value={availabilityForm.break_end_time || 'No break'}
                  helperText="Optional. Leave empty if you do not need a break."
                  onPress={() => openTimePicker('break_end_time')}
                />

                <Button fullWidth loading={submitting} onPress={submitAvailability}>
                  {editingAvailabilityId ? 'Update availability' : 'Save availability'}
                </Button>
                {editingAvailabilityId ? (
                  <Button
                    variant="outline"
                    fullWidth
                    className="mt-3"
                    onPress={resetAvailabilityForm}
                  >
                    Cancel edit
                  </Button>
                ) : null}
              </Card>

              <Card className="mb-4 border-border/90">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-text">
                    Saved availability
                  </Text>
                  <Button size="sm" onPress={generateSlots} loading={submitting}>
                    Generate slots
                  </Button>
                </View>
                {availability.length === 0 ? (
                  <Text className="text-sm text-text-secondary">
                    Add a weekly window to start generating future appointment slots.
                  </Text>
                ) : (
                  availability.map((item) => (
                    <View
                      key={item.id}
                      className="mb-3 rounded-xl border border-border bg-background p-4"
                    >
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-base font-semibold text-text">
                          {weekdays.find((day) => day.value === item.weekday)?.label} {item.start_time}
                          {' - '}
                          {item.end_time}
                        </Text>
                        <Badge variant={item.is_active ? 'success' : 'warning'} size="sm">
                          {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </View>
                      <Text className="mb-3 text-sm text-text-secondary">
                        {item.slot_duration_minutes} minute slots
                        {item.break_start_time && item.break_end_time
                          ? ` - break ${item.break_start_time}-${item.break_end_time}`
                          : ''}
                      </Text>
                      <View className="flex-row">
                        <Button
                          variant="outline"
                          className="mr-2 flex-1"
                          onPress={() => editAvailability(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="text"
                          className="flex-1"
                          onPress={() => deleteAvailability(item.id)}
                        >
                          Delete
                        </Button>
                      </View>
                    </View>
                  ))
                )}
              </Card>

              <Card className="mb-4 border-border/90">
                <Text className="mb-3 text-base font-semibold text-text">
                  Slot overview
                </Text>
                {doctorSlots.length === 0 ? (
                  <Text className="text-sm text-text-secondary">
                    Generate slots to see the next available, booked, blocked, and
                    completed time windows.
                  </Text>
                ) : (
                  doctorSlots.slice(0, 12).map((slot) => (
                    <View
                      key={slot.id}
                      className="mb-3 rounded-xl border border-border bg-background p-4"
                    >
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-base font-semibold text-text">
                          {slot.display_date} at {slot.display_time}
                        </Text>
                        <Badge variant={getBadgeVariant(slot.status)} size="sm">
                          {slot.status.toUpperCase()}
                        </Badge>
                      </View>
                      <Text className="mb-3 text-sm text-text-secondary">
                        {slot.patient_name
                          ? `Patient: ${slot.patient_name}`
                          : 'Open for booking'}
                      </Text>
                      {slot.status === 'available' ? (
                        <Button
                          variant="outline"
                          fullWidth
                          onPress={() => blockSlot(slot.id)}
                        >
                          Block slot
                        </Button>
                      ) : null}
                    </View>
                  ))
                )}
              </Card>

              <Card className="border-border/90">
                <Text className="mb-3 text-base font-semibold text-text">
                  Upcoming confirmed appointments
                </Text>
                {doctorAppointments.length === 0 ? (
                  <Text className="text-sm text-text-secondary">
                    Booked appointments will show here as soon as patients select a slot.
                  </Text>
                ) : (
                  doctorAppointments.map((appointment) => (
                    <View
                      key={appointment.id}
                      className="mb-3 rounded-[18px] border border-coral-soft bg-surface-soft p-4"
                    >
                        <View className="mb-2 flex-row items-center justify-between">
                          <Text className="text-base font-semibold text-text">
                            {appointment.patient_name || 'Patient'}
                          </Text>
                          <Badge variant={getBadgeVariant(appointment.status)} size="sm">
                            {appointment.status.toUpperCase()}
                          </Badge>
                        </View>
                        <Text className="mb-1 text-sm text-text-secondary">
                          {appointment.display_date} at {appointment.display_time}
                        </Text>
                        <Text className="mb-3 text-sm text-text-secondary">
                          {appointment.reason_for_visit || 'General consultation'}
                        </Text>
                        <View className="flex-row">
                          <Button
                            variant="text"
                            className={appointment.status === 'booked' ? 'mr-2' : ''}
                            onPress={() => router.push(`/appointments/${appointment.id}` as any)}
                          >
                            Details
                          </Button>
                          {appointment.status === 'booked' ? (
                            <>
                              <Button
                                variant="outline"
                                className="mr-2 flex-1"
                                onPress={() => cancelDoctorAppointment(appointment.id)}
                              >
                                Cancel
                              </Button>
                              <Button
                                className="flex-1"
                                onPress={() => completeDoctorAppointment(appointment.id)}
                              >
                                Complete
                              </Button>
                            </>
                          ) : null}
                        </View>
                    </View>
                  ))
                )}
              </Card>
            </>
          ) : role === 'patient' ? (
            <>
              <Card className="mb-4 bg-surface-soft border-coral-soft shadow-sm">
                <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-1">
                  Patient
                </Text>
                <Text className="mb-1 text-lg font-semibold text-text leading-6">Book a visit</Text>
                <Text className="text-sm leading-6 text-text-secondary">
                  Choose your doctor, pick an open slot, and your booking is confirmed immediately.
                </Text>
              </Card>

              <View className="mb-4 flex-row justify-between rounded-[20px] border border-coral-soft bg-white px-3 py-4">
                {(['Doctor', 'Time', 'Confirm'] as const).map((label, index) => (
                  <View key={label} className="flex-1 items-center px-1">
                    <View className="mb-2 h-9 w-9 items-center justify-center rounded-full bg-coral-soft">
                      <Text className="text-sm font-bold text-coral-ink">{index + 1}</Text>
                    </View>
                    <Text className="text-center text-[11px] font-semibold text-text-secondary leading-4">
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              <Card className="mb-4 border-coral-soft bg-white">
                <Text className="mb-1 text-base font-semibold text-text">
                  Select doctor
                </Text>
                <Text className="mb-3 text-sm text-text-secondary leading-5">
                  Your care team is highlighted; you can still view other clinicians with open slots.
                </Text>
                {doctors.length === 0 ? (
                  <Text className="text-sm text-text-secondary">
                    No doctors are available right now.
                  </Text>
                ) : (
                  <View>
                    {doctors.map((doctor) => {
                      const selected = selectedDoctorId === doctor.id;
                      return (
                        <TouchableOpacity
                          key={doctor.id}
                          onPress={() => {
                            setSelectedDoctorId(doctor.id);
                            setSelectedSlotId('');
                          }}
                          activeOpacity={0.88}
                          className="mb-3 last:mb-0"
                        >
                          <View
                            className={`overflow-hidden rounded-[18px] border bg-surface-soft pl-0 flex-row ${
                              selected ? 'border-coral-deep' : 'border-coral-soft'
                            }`}
                          >
                            <View className="w-1.5 bg-coral self-stretch" />
                            <View className="flex-1 py-3 pr-3 pl-3">
                              <View className="flex-row items-start justify-between gap-2">
                                <View className="flex-1">
                                  <Text
                                    className={`text-base font-semibold ${
                                      selected ? 'text-coral-ink' : 'text-text'
                                    }`}
                                  >
                                    {doctor.name}
                                  </Text>
                                  <Text className="text-sm text-text-secondary mt-0.5">
                                    {doctor.specialization}
                                  </Text>
                                </View>
                                {assignedDoctorId === doctor.id ? (
                                  <View className="rounded-full bg-coral-soft px-2.5 py-1">
                                    <Text className="text-[10px] font-bold uppercase tracking-wide text-coral-deep">
                                      Care team
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </Card>

              <Card className="mb-4 border-border/90">
                <Text className="mb-3 text-base font-semibold text-text">
                  Available slots
                </Text>
                {selectedDoctor ? (
                  <Text className="mb-3 text-sm text-text-secondary">
                    Showing live availability for {selectedDoctor.name}.
                  </Text>
                ) : null}
                {slotDates.length > 0 ? (
                  <View className="mb-3 flex-row flex-wrap">
                    {slotDates.map((slotDate) => (
                      <TouchableOpacity
                        key={slotDate}
                        onPress={() => {
                          setSelectedSlotDate(slotDate);
                          setSelectedSlotId('');
                        }}
                        className={`mb-2 mr-2 rounded-xl border px-4 py-3 ${
                          selectedSlotDate === slotDate
                            ? 'border-coral-deep bg-coral-soft'
                            : 'border-border bg-background'
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            selectedSlotDate === slotDate ? 'text-coral-ink' : 'text-text'
                          }`}
                        >
                          {new Date(`${slotDate}T00:00:00`).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {patientSlots.length === 0 ? (
                  <Text className="text-sm text-text-secondary">
                    No open slots found for the selected doctor yet.
                  </Text>
                ) : (
                  visiblePatientSlots.slice(0, 16).map((slot) => (
                    <TouchableOpacity
                      key={slot.id}
                      onPress={() => setSelectedSlotId(slot.id)}
                      className={`mb-3 rounded-xl border p-4 ${
                        selectedSlotId === slot.id
                          ? 'border-coral-deep bg-coral-soft'
                          : 'border-border bg-background'
                      }`}
                    >
                      <Text className="text-base font-semibold text-text">
                        {slot.display_date} at {slot.display_time}
                      </Text>
                      <Text className="mt-1 text-sm text-text-secondary">
                        Tap to book this slot instantly.
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </Card>

              <Card className="mb-4 border-border/90">
                <Text className="mb-3 text-base font-semibold text-text">
                  Booking details
                </Text>
                <TextInput
                  className="mb-3 rounded-xl border border-border px-4 py-3 text-text"
                  placeholder="Reason for visit"
                  placeholderTextColor="#9CA3AF"
                  value={reasonForVisit}
                  onChangeText={setReasonForVisit}
                />
                <TextInput
                  className="min-h-[110px] rounded-xl border border-border px-4 py-3 text-text"
                  placeholder="Optional note"
                  placeholderTextColor="#9CA3AF"
                  value={patientNote}
                  onChangeText={setPatientNote}
                  multiline
                  textAlignVertical="top"
                />
                <Button fullWidth className="mt-4" onPress={bookAppointment} loading={submitting}>
                  Book selected slot
                </Button>
              </Card>

              <Card className="border-border/90">
                <Text className="mb-3 text-base font-semibold text-text">
                  Your upcoming appointments
                </Text>
                {patientAppointments.length === 0 ? (
                  <EmptyState
                    title="No bookings yet"
                    message="Pick a doctor and choose one of the available slots above."
                  />
                ) : (
                  patientAppointments.map((appointment) => (
                    <View
                      key={appointment.id}
                      className="mb-3 rounded-[18px] border border-coral-soft bg-surface-soft p-4"
                    >
                        <View className="mb-2 flex-row items-center justify-between">
                          <Text className="text-base font-semibold text-text">
                            {appointment.doctor_name || 'Doctor'}
                          </Text>
                          <Badge variant={getBadgeVariant(appointment.status)} size="sm">
                            {appointment.status.toUpperCase()}
                          </Badge>
                        </View>
                        <Text className="mb-1 text-sm text-text-secondary">
                          {appointment.display_date} at {appointment.display_time}
                        </Text>
                        <Text className="mb-3 text-sm text-text-secondary">
                          {appointment.reason_for_visit || 'General consultation'}
                        </Text>
                        <View className="flex-row">
                          <Button
                            variant="text"
                            className={appointment.status === 'booked' ? 'mr-2' : ''}
                            onPress={() => router.push(`/appointments/${appointment.id}` as any)}
                          >
                            Details
                          </Button>
                          {appointment.status === 'booked' ? (
                            <Button
                              variant="outline"
                              className="flex-1"
                              onPress={() => cancelPatientAppointment(appointment.id)}
                            >
                              Cancel booking
                            </Button>
                          ) : null}
                        </View>
                    </View>
                  ))
                )}
              </Card>
            </>
          ) : (
            <EmptyState
              title="Scheduling unavailable"
              message="Please log in as a doctor or patient to use scheduling."
            />
          )}
        </View>
      </ScrollView>
      {Platform.OS !== 'web' && timePicker.visible && timePicker.field ? (
        <DateTimePicker
          mode="time"
          value={timeValueToDate(activePickerValue || '09:00')}
          is24Hour
          display="default"
          onChange={handleNativeTimePicked}
        />
      ) : null}
    </SafeAreaView>
  );
}
