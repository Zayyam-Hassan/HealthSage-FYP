import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
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
import {
  appointmentsService,
  type Appointment,
  type AppointmentSlot,
  type Availability,
  type SchedulingWeekday,
} from '@/services/appointments';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { colors } from '@/constants/colors';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { filterUpcomingBookedAppointments } from '@/utils/appointmentFilters';
import AppointmentMonthCalendar from './AppointmentMonthCalendar';

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

const WEEKDAY_ORDER: SchedulingWeekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function formatScheduleDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateKeyToLocalDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToSchedulingWeekday(d: Date): SchedulingWeekday {
  return WEEKDAY_ORDER[d.getDay()];
}

function nextOccurrenceDateForWeekday(weekday: SchedulingWeekday): Date {
  const idx = WEEKDAY_ORDER.indexOf(weekday);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const current = d.getDay();
  const add = (idx - current + 7) % 7;
  d.setDate(d.getDate() + add);
  return d;
}

const WEEKDAY_LONG: Record<SchedulingWeekday, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

function emptyAvailabilityForm(weekday: SchedulingWeekday = 'monday') {
  return {
    weekday,
    start_time: '09:00',
    end_time: '13:00',
    slot_duration_minutes: '30',
    break_start_time: '',
    break_end_time: '',
  };
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ doctor_id?: string }>();
  const { role, refreshUser, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availabilityForm, setAvailabilityForm] = useState(() =>
    emptyAvailabilityForm(dateToSchedulingWeekday(new Date())),
  );
  const [selectedScheduleDateKeys, setSelectedScheduleDateKeys] = useState(() => [
    formatScheduleDayKey(new Date()),
  ]);
  const [scheduleViewYear, setScheduleViewYear] = useState(() => new Date().getFullYear());
  const [scheduleViewMonth, setScheduleViewMonth] = useState(() => new Date().getMonth());
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [doctorSlots, setDoctorSlots] = useState<AppointmentSlot[]>([]);
  const [doctorAppointments, setDoctorAppointments] = useState<Appointment[]>([]);

  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [timePicker, setTimePicker] = useState<{
    visible: boolean;
    field: 'start_time' | 'end_time' | 'break_start_time' | 'break_end_time' | null;
  }>({ visible: false, field: null });
  const { dialog, hideDialog, showDialog } = useAppDialog();
  const [doctorTab, setDoctorTab] = useState<'schedule' | 'slots' | 'appointments'>('schedule');

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
      appointmentsService.getDoctorSlots(),
      appointmentsService.getDoctorAppointments({ limit: 50 }),
    ]);

    setAvailability(availabilityRes.items);
    setDoctorSlots(slotsRes.items);
    setDoctorAppointments(appointmentsRes.items);
  }, []);

  const loadPatientData = useCallback(async () => {
    const appointmentsRes = await appointmentsService.getPatientAppointments({ limit: 50 });
    setPatientAppointments(appointmentsRes.items);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const currentUser = await refreshUser();
      const currentRole = currentUser?.role ?? null;

      if (currentRole === 'doctor') {
        await loadDoctorData();
      } else if (currentRole === 'patient') {
        await loadPatientData();
      } else {
        setAvailability([]);
        setDoctorSlots([]);
        setDoctorAppointments([]);
        setPatientAppointments([]);
      }
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to load scheduling'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadDoctorData, loadPatientData, refreshUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (role === 'patient' && params.doctor_id) {
      router.replace({
        pathname: '/appointments/confirm-booking',
        params: { doctorId: params.doctor_id },
      } as never);
    }
  }, [role, params.doctor_id, router]);

  const visiblePatientAppointments = useMemo(
    () =>
      role === 'patient' ? filterUpcomingBookedAppointments(patientAppointments) : [],
    [role, patientAppointments],
  );

  const activePickerValue = timePicker.field
    ? availabilityForm[timePicker.field] || ''
    : '';

  const resetAvailabilityForm = () => {
    const t = new Date();
    setAvailabilityForm(emptyAvailabilityForm(dateToSchedulingWeekday(t)));
    setScheduleViewYear(t.getFullYear());
    setScheduleViewMonth(t.getMonth());
    setSelectedScheduleDateKeys([formatScheduleDayKey(t)]);
    setEditingAvailabilityId(null);
  };

  const submitAvailability = async () => {
    const slotDuration = Number(availabilityForm.slot_duration_minutes);

    if (!Number.isFinite(slotDuration)) {
      showDialog('Invalid duration', 'Please choose a valid slot duration.');
      return;
    }

    if (!editingAvailabilityId && selectedScheduleDateKeys.length === 0) {
      showDialog('Select dates', 'Select at least one date on the calendar.');
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
        const uniqueWeekdays = [
          ...new Set(
            selectedScheduleDateKeys.map((k) =>
              dateToSchedulingWeekday(dateKeyToLocalDate(k)),
            ),
          ),
        ].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));

        for (const wd of uniqueWeekdays) {
          const body = { ...payload, weekday: wd };
          const existing = availability.find((a) => a.weekday === wd);
          if (existing) {
            await appointmentsService.updateDoctorAvailability(existing.id, body);
          } else {
            await appointmentsService.createDoctorAvailability(body);
          }
        }
      }

      await appointmentsService.generateDoctorSlots({ days_ahead: 14 });
      resetAvailabilityForm();
      await loadDoctorData();
    } catch (err: any) {
      showDialog('Unable to save availability', formatApiError(err, 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const generateSlots = async () => {
    try {
      setSubmitting(true);
      const response = await appointmentsService.generateDoctorSlots({ days_ahead: 14 });
      await loadDoctorData();
      showDialog(
        'Slots generated',
        `${response.generated_count} new slots are ready. ${response.skipped_count} existing slots were kept.`,
      );
    } catch (err: any) {
      showDialog('Unable to generate slots', formatApiError(err, 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const editAvailability = (item: Availability) => {
    setEditingAvailabilityId(item.id);
    const anchor = nextOccurrenceDateForWeekday(item.weekday);
    setScheduleViewYear(anchor.getFullYear());
    setScheduleViewMonth(anchor.getMonth());
    setSelectedScheduleDateKeys([formatScheduleDayKey(anchor)]);
    setAvailabilityForm({
      weekday: item.weekday,
      start_time: item.start_time,
      end_time: item.end_time,
      slot_duration_minutes: String(item.slot_duration_minutes),
      break_start_time: item.break_start_time || '',
      break_end_time: item.break_end_time || '',
    });
  };

  const shiftScheduleMonth = useCallback((delta: number) => {
    const d = new Date(scheduleViewYear, scheduleViewMonth + delta, 1);
    setScheduleViewYear(d.getFullYear());
    setScheduleViewMonth(d.getMonth());
  }, [scheduleViewYear, scheduleViewMonth]);

  const scheduleMonthSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
        onPanResponderRelease: (_, g) => {
          if (g.dx > 48) shiftScheduleMonth(-1);
          else if (g.dx < -48) shiftScheduleMonth(1);
        },
      }),
    [shiftScheduleMonth],
  );

  const onPressScheduleCalendarDay = (day: number) => {
    const key = `${scheduleViewYear}-${String(scheduleViewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (editingAvailabilityId) {
      setSelectedScheduleDateKeys([key]);
      setAvailabilityForm((c) => ({
        ...c,
        weekday: dateToSchedulingWeekday(new Date(scheduleViewYear, scheduleViewMonth, day)),
      }));
      return;
    }
    setSelectedScheduleDateKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const recurringWeekdaysLabel = useMemo(() => {
    const unique = [
      ...new Set(
        selectedScheduleDateKeys.map((k) =>
          dateToSchedulingWeekday(dateKeyToLocalDate(k)),
        ),
      ),
    ].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
    return unique.map((w) => WEEKDAY_LONG[w]).join(', ');
  }, [selectedScheduleDateKeys]);

  const deleteAvailability = (availabilityId: string) => {
    showDialog('Delete availability', 'This removes future open slots from this window.', [
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
            showDialog('Unable to delete', formatApiError(err, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const blockSlot = (slotId: string) => {
    showDialog('Block slot', 'This slot will no longer be bookable.', [
      { label: 'Keep open', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Block',
        variant: 'danger',
        onPress: async () => {
          try {
            await appointmentsService.blockDoctorSlot(slotId);
            await loadDoctorData();
          } catch (err: any) {
            showDialog('Unable to block slot', formatApiError(err, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const cancelDoctorAppointment = (appointmentId: string) => {
    showDialog('Cancel appointment', 'This confirmed appointment will be cancelled.', [
      { label: 'Keep', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Cancel appointment',
        variant: 'danger',
        onPress: async () => {
          try {
            await appointmentsService.cancelDoctorAppointment(appointmentId);
            await loadDoctorData();
          } catch (err: any) {
            showDialog('Unable to cancel', formatApiError(err, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const completeDoctorAppointment = (appointmentId: string) => {
    showDialog('Complete appointment', 'Mark this appointment as completed?', [
      { label: 'Not yet', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Complete',
        onPress: async () => {
          try {
            await appointmentsService.completeDoctorAppointment(appointmentId);
            await loadDoctorData();
          } catch (err: any) {
            showDialog('Unable to complete', formatApiError(err, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const cancelPatientAppointment = (appointmentId: string) => {
    showDialog('Cancel booking', 'This upcoming booking will be cancelled.', [
      { label: 'Keep booking', onPress: () => {}, variant: 'secondary' },
      {
        label: 'Cancel booking',
        variant: 'danger',
        onPress: async () => {
          try {
            await appointmentsService.cancelPatientAppointment(appointmentId);
            await loadPatientData();
          } catch (err: any) {
            showDialog('Unable to cancel', formatApiError(err, 'Please try again.'));
          }
        },
      },
    ]);
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header
          variant="coral"
          title={role === 'patient' ? 'Book appointment' : 'Scheduling'}
          showBack
        />
        <CenteredScreenLoader />
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
        onClose={hideDialog}
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
      <Header
        variant="coral"
        title={role === 'patient' ? 'Book appointment' : 'Scheduling'}
        showBack
      />
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
              <View className="mb-4 flex-row rounded-[20px] border border-coral-soft bg-white p-1">
                {(
                  [
                    { key: 'schedule' as const, label: 'Schedule' },
                    { key: 'slots' as const, label: 'Slots' },
                    { key: 'appointments' as const, label: 'Visits' },
                  ] as const
                ).map((tab) => {
                  const active = doctorTab === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setDoctorTab(tab.key)}
                      className={`flex-1 rounded-2xl py-2.5 ${active ? 'bg-coral-soft' : ''}`}
                      activeOpacity={0.85}
                    >
                      <Text
                        className={`text-center text-sm font-bold ${
                          active ? 'text-coral-ink' : 'text-text-secondary'
                        }`}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {doctorTab === 'schedule' ? (
                <>
                  <Card className="mb-4 border-coral-soft bg-white">
                    <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-coral-deep">
                      Clinician
                    </Text>
                    <Text className="text-base font-semibold text-text">
                      {editingAvailabilityId ? 'Update window' : 'New availability window'}
                    </Text>

                    <View className="mt-2">
                      <AppointmentMonthCalendar
                        viewYear={scheduleViewYear}
                        viewMonth={scheduleViewMonth}
                        panHandlers={scheduleMonthSwipeResponder.panHandlers}
                        onShiftMonth={shiftScheduleMonth}
                        isDaySelected={(dayKey) =>
                          editingAvailabilityId
                            ? selectedScheduleDateKeys[0] === dayKey
                            : selectedScheduleDateKeys.includes(dayKey)
                        }
                        onPressCalendarDay={onPressScheduleCalendarDay}
                      />
                    </View>
                    <Text className="mb-3 text-xs text-text-secondary">
                      Recurring weekly on{' '}
                      <Text className="font-semibold text-text">{recurringWeekdaysLabel}</Text>
                      {editingAvailabilityId
                        ? '.'
                        : '. Tap multiple dates (same month or others) to apply these hours to every matching weekday; tap again to remove.'}
                    </Text>

                    <Text className="mb-2 text-xs font-semibold uppercase text-text-secondary">
                      Session hours
                    </Text>
                    <View className="mb-4 flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => openTimePicker('start_time')}
                        className="flex-1 rounded-full border border-coral-soft bg-coral-soft px-3 py-3"
                        activeOpacity={0.85}
                      >
                        <Text className="text-center text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                          Start
                        </Text>
                        <Text className="mt-1 text-center text-lg font-bold text-coral-ink">
                          {availabilityForm.start_time}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openTimePicker('end_time')}
                        className="flex-1 rounded-full border border-coral-soft bg-coral-soft px-3 py-3"
                        activeOpacity={0.85}
                      >
                        <Text className="text-center text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                          End
                        </Text>
                        <Text className="mt-1 text-center text-lg font-bold text-coral-ink">
                          {availabilityForm.end_time}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text className="mb-2 text-xs font-semibold uppercase text-text-secondary">
                      Slot length
                    </Text>
                    <View className="mb-4 flex-row flex-wrap gap-2">
                      {slotDurationOptions.map((opt) => {
                        const active = availabilityForm.slot_duration_minutes === opt;
                        return (
                          <TouchableOpacity
                            key={opt}
                            onPress={() =>
                              setAvailabilityForm((current) => ({
                                ...current,
                                slot_duration_minutes: opt,
                              }))
                            }
                            className={`rounded-full border px-4 py-2.5 ${
                              active
                                ? 'border-coral-deep bg-coral-soft'
                                : 'border-border bg-white'
                            }`}
                          >
                            <Text
                              className={`text-sm font-semibold ${
                                active ? 'text-coral-ink' : 'text-text'
                              }`}
                            >
                              {opt} min
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text className="mb-2 text-xs font-semibold uppercase text-text-secondary">
                      Break (optional)
                    </Text>
                    <View className="mb-2 flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => openTimePicker('break_start_time')}
                        className="flex-1 rounded-full border border-border bg-bg-secondary px-3 py-2.5"
                        activeOpacity={0.85}
                      >
                        <Text className="text-center text-[10px] font-semibold text-text-secondary">
                          From
                        </Text>
                        <Text className="mt-0.5 text-center text-base font-semibold text-text">
                          {availabilityForm.break_start_time || '—'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openTimePicker('break_end_time')}
                        className="flex-1 rounded-full border border-border bg-bg-secondary px-3 py-2.5"
                        activeOpacity={0.85}
                      >
                        <Text className="text-center text-[10px] font-semibold text-text-secondary">
                          To
                        </Text>
                        <Text className="mt-0.5 text-center text-base font-semibold text-text">
                          {availabilityForm.break_end_time || '—'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setAvailabilityForm((current) => ({
                          ...current,
                          break_start_time: '',
                          break_end_time: '',
                        }))
                      }
                      className="mb-4 self-start py-1"
                    >
                      <Text className="text-xs font-semibold text-coral-deep">Clear break</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={submitAvailability}
                      disabled={submitting}
                      className="items-center rounded-2xl bg-coral py-4 active:opacity-90 disabled:opacity-50"
                      activeOpacity={0.85}
                    >
                      <Text className="text-base font-bold text-white">
                        {submitting
                          ? 'Saving…'
                          : editingAvailabilityId
                            ? 'Update availability'
                            : 'Save availability'}
                      </Text>
                    </TouchableOpacity>
                    {editingAvailabilityId ? (
                      <TouchableOpacity onPress={resetAvailabilityForm} className="mt-3 items-center py-2">
                        <Text className="text-sm font-semibold text-text-secondary">Cancel edit</Text>
                      </TouchableOpacity>
                    ) : null}
                  </Card>

                  <Card className="mb-4 border-coral-soft bg-white">
                    <View className="mb-3 flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-text">Saved windows</Text>
                      <TouchableOpacity
                        onPress={generateSlots}
                        disabled={submitting}
                        className="rounded-full bg-coral-soft px-4 py-2"
                        activeOpacity={0.85}
                      >
                        <Text className="text-xs font-bold text-coral-ink">
                          {submitting ? '…' : 'Generate slots'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {availability.length === 0 ? (
                      <Text className="text-sm font-medium text-text-secondary">
                        Save a window, then generate slots for the next two weeks.
                      </Text>
                    ) : (
                      availability.map((item) => (
                        <View
                          key={item.id}
                          className="mb-2 rounded-2xl border border-coral-soft/90 bg-surface-soft px-3 py-3 last:mb-0"
                        >
                          <View className="mb-1 flex-row items-center justify-between">
                            <Text className="text-sm font-bold text-text">
                              {weekdays.find((day) => day.value === item.weekday)?.label} ·{' '}
                              {item.start_time}–{item.end_time}
                            </Text>
                            <Badge variant={item.is_active ? 'success' : 'warning'} size="sm">
                              {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </Badge>
                          </View>
                          <Text className="mb-2 text-xs text-text-secondary">
                            {item.slot_duration_minutes} min slots
                            {item.break_start_time && item.break_end_time
                              ? ` · break ${item.break_start_time}–${item.break_end_time}`
                              : ''}
                          </Text>
                          <View className="flex-row gap-2">
                            <TouchableOpacity
                              onPress={() => editAvailability(item)}
                              className="flex-1 items-center rounded-full border border-coral-soft py-2"
                            >
                              <Text className="text-xs font-bold text-coral-ink">Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => deleteAvailability(item.id)}
                              className="flex-1 items-center rounded-full border border-border py-2"
                            >
                              <Text className="text-xs font-bold text-text-secondary">Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </Card>
                </>
              ) : null}

              {doctorTab === 'slots' ? (
                <Card className="mb-4 border-coral-soft bg-white">
                  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-coral-deep">
                    Slot board
                  </Text>
                  <Text className="mb-3 text-sm text-text-secondary">
                    Live slots — available, booked, blocked, or completed.
                  </Text>
                  {doctorSlots.length === 0 ? (
                    <Text className="text-sm font-medium text-text-secondary">
                      Generate slots from the Schedule tab to populate this list.
                    </Text>
                  ) : (
                    doctorSlots.slice(0, 12).map((slot) => (
                      <View
                        key={slot.id}
                        className="mb-2 rounded-2xl border border-coral-soft/80 bg-surface-soft px-3 py-3 last:mb-0"
                      >
                        <View className="mb-1 flex-row items-center justify-between">
                          <Text className="text-sm font-bold text-text">
                            {slot.display_date} · {slot.display_time}
                          </Text>
                          <Badge variant={getBadgeVariant(slot.status)} size="sm">
                            {slot.status.toUpperCase()}
                          </Badge>
                        </View>
                        <Text className="mb-2 text-xs text-text-secondary">
                          {slot.patient_name ? `Patient: ${slot.patient_name}` : 'Open for booking'}
                        </Text>
                        {slot.status === 'available' ? (
                          <TouchableOpacity
                            onPress={() => blockSlot(slot.id)}
                            className="items-center rounded-full border border-coral-soft py-2"
                          >
                            <Text className="text-xs font-bold text-coral-ink">Block slot</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))
                  )}
                </Card>
              ) : null}

              {doctorTab === 'appointments' ? (
                <Card className="border-coral-soft bg-white">
                  <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-coral-deep">
                    Confirmed visits
                  </Text>
                  <Text className="mb-3 text-sm text-text-secondary">
                    Upcoming patient appointments you&apos;ve accepted.
                  </Text>
                  {doctorAppointments.length === 0 ? (
                    <Text className="text-sm font-medium text-text-secondary">
                      Bookings appear here when patients book your open slots.
                    </Text>
                  ) : (
                    doctorAppointments.map((appointment) => (
                      <View
                        key={appointment.id}
                        className="mb-2 rounded-2xl border border-coral-soft bg-surface-soft px-3 py-3 last:mb-0"
                      >
                        <View className="mb-1 flex-row items-center justify-between">
                          <Text className="text-sm font-bold text-text">
                            {appointment.patient_name || 'Patient'}
                          </Text>
                          <Badge variant={getBadgeVariant(appointment.status)} size="sm">
                            {appointment.status.toUpperCase()}
                          </Badge>
                        </View>
                        <Text className="text-xs text-text-secondary">
                          {appointment.display_date} · {appointment.display_time}
                        </Text>
                        <Text className="mb-2 text-xs text-text-secondary">
                          {appointment.reason_for_visit || 'General consultation'}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          <TouchableOpacity
                            onPress={() => router.push(`/appointments/${appointment.id}` as any)}
                            className="rounded-full border border-coral-soft px-3 py-1.5"
                          >
                            <Text className="text-xs font-bold text-coral-ink">Details</Text>
                          </TouchableOpacity>
                          {appointment.status === 'booked' ? (
                            <>
                              <TouchableOpacity
                                onPress={() => cancelDoctorAppointment(appointment.id)}
                                className="rounded-full border border-border px-3 py-1.5"
                              >
                                <Text className="text-xs font-bold text-text-secondary">Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => completeDoctorAppointment(appointment.id)}
                                className="rounded-full bg-coral px-3 py-1.5"
                              >
                                <Text className="text-xs font-bold text-white">Complete</Text>
                              </TouchableOpacity>
                            </>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </Card>
              ) : null}
            </>
          ) : role === 'patient' ? (
            <>
              <Card className="mb-4 bg-surface-soft border-coral-soft shadow-sm">
                <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-1">
                  Book a visit
                </Text>
                <Text className="mb-3 text-sm leading-6 text-text-secondary">
                  Choose a doctor from the directory, then pick a time — one place for booking.
                </Text>
                <Button
                  onPress={() => router.push('/psychiatrist' as never)}
                  fullWidth
                >
                  Find a doctor
                </Button>
              </Card>

              <Card className="border-border/90">
                <Text className="mb-3 text-base font-semibold text-text">
                  Your upcoming appointments
                </Text>
                {visiblePatientAppointments.length === 0 ? (
                  <EmptyState
                    title="No upcoming bookings"
                    message="Book from Find a doctor to see visits here."
                  />
                ) : (
                  visiblePatientAppointments.map((appointment) => (
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
                      {appointment.status === 'booked' ? (
                        <Button
                          variant="outline"
                          fullWidth
                          onPress={() => cancelPatientAppointment(appointment.id)}
                        >
                          Cancel booking
                        </Button>
                      ) : null}
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
