import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import BookingSuccessModal from '@/components/BookingSuccessModal';
import { colors } from '@/constants/colors';
import { appointmentsService, type AppointmentSlot } from '@/services/appointments';
import { doctorsService, type Doctor } from '@/services/doctors';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import AppointmentMonthCalendar, {
  firstSelectableDayInMonth,
} from './AppointmentMonthCalendar';

/** Match reference: same minute options as design */
const REMINDER_OPTIONS = [30, 40, 25, 10, 35] as const;

/** Calendar day key for grouping — prefer server `slot_date` so it matches the grid and DB day. */
function slotCalendarDateKey(s: AppointmentSlot): string {
  if (s.slot_date && /^\d{4}-\d{2}-\d{2}$/.test(s.slot_date)) {
    return s.slot_date;
  }
  const d = new Date(s.start_datetime);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function AppointmentScreenHeader({ onBack }: { onBack: () => void }) {
  return (
    <View className="bg-coral px-4 pb-4 pt-1">
      <View className="flex-row items-center rounded-full bg-white px-2 py-3 shadow-sm">
        <TouchableOpacity
          onPress={onBack}
          className="z-10 h-10 w-10 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
            size={Platform.OS === 'ios' ? 26 : 22}
            color={colors.text.primary}
          />
        </TouchableOpacity>
        <Text
          className="absolute left-0 right-0 text-center text-lg font-bold text-text"
          pointerEvents="none"
        >
          Appointment
        </Text>
        <View className="w-10" />
      </View>
    </View>
  );
}

export default function ConfirmBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { doctorId, slotId: slotIdParam } = useLocalSearchParams<{
    doctorId: string;
    slotId?: string;
  }>();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [allSlots, setAllSlots] = useState<AppointmentSlot[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(25);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      setError(null);
      setLoading(true);
      const [doc, slotsRes] = await Promise.all([
        doctorsService.getDoctor(doctorId),
        appointmentsService.getDoctorPublicSlots(doctorId, { days_ahead: 30 }),
      ]);
      const available = slotsRes.items.filter((s) => s.status === 'available');
      setDoctor(doc);
      setAllSlots(available);

      if (available.length === 0) {
        setSelectedSlot(null);
        setSelectedDateKey('');
        setError('No open slots for this doctor yet. Check back later.');
        const now = new Date();
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
        return;
      }

      let initial: AppointmentSlot | null = null;
      if (slotIdParam) {
        initial = available.find((s) => s.id === slotIdParam) ?? null;
        if (!initial) {
          setError('That time slot is no longer available. Choose another time below.');
        }
      }
      if (!initial) {
        initial = [...available].sort(
          (a, b) =>
            new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime(),
        )[0];
      }
      const initialKey = slotCalendarDateKey(initial);
      setSelectedDateKey(initialKey);
      setSelectedSlot(initial);
      const d = new Date(initial.start_datetime);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } catch (err: unknown) {
      setError(formatApiError(err, 'Could not load booking details.'));
    } finally {
      setLoading(false);
    }
  }, [doctorId, slotIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, AppointmentSlot[]>();
    for (const s of allSlots) {
      const key = slotCalendarDateKey(s);
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime(),
      );
    }
    return map;
  }, [allSlots]);

  const sortedDateKeys = useMemo(
    () => [...slotsByDate.keys()].sort((a, b) => a.localeCompare(b)),
    [slotsByDate],
  );

  const timesForSelectedDay = useMemo(() => {
    if (!selectedDateKey) return [];
    return slotsByDate.get(selectedDateKey) ?? [];
  }, [selectedDateKey, slotsByDate]);

  const noSlotsOnSelectedDay = timesForSelectedDay.length === 0;

  const confirmLine = useMemo(() => {
    if (!selectedSlot) return { dateLine: '', timeLine: '' };
    return {
      dateLine: selectedSlot.display_date,
      timeLine: selectedSlot.display_time,
    };
  }, [selectedSlot]);

  const nextAvailabilityLabel = useMemo(() => {
    if (!selectedDateKey || sortedDateKeys.length === 0) return null;
    const next = sortedDateKeys.find((d) => d > selectedDateKey);
    if (!next) return null;
    const d = new Date(`${next}T12:00:00`);
    return `Next availability on ${d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })}`;
  }, [selectedDateKey, sortedDateKeys]);

  const shiftMonth = useCallback(
    (delta: number) => {
      const d = new Date(viewYear, viewMonth + delta, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      setViewYear(y);
      setViewMonth(m);
      const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
      const keysInMonth = sortedDateKeys.filter((k) => k.startsWith(monthPrefix));
      if (keysInMonth.length > 0) {
        const key = keysInMonth[0];
        setSelectedDateKey(key);
        const daySlots = slotsByDate.get(key);
        setSelectedSlot(daySlots?.[0] ?? null);
        return;
      }
      const day = firstSelectableDayInMonth(y, m);
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setSelectedDateKey(key);
      setSelectedSlot(null);
    },
    [viewYear, viewMonth, slotsByDate, sortedDateKeys],
  );

  const monthSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
        onPanResponderRelease: (_, g) => {
          if (g.dx > 48) shiftMonth(-1);
          else if (g.dx < -48) shiftMonth(1);
        },
      }),
    [shiftMonth],
  );

  const onPressCalendarDay = (day: number) => {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDateKey(key);
    const daySlots = slotsByDate.get(key);
    if (daySlots?.length) {
      setSelectedSlot(daySlots[0]);
    } else {
      setSelectedSlot(null);
    }
  };

  const goNextAvailability = () => {
    if (!selectedDateKey) return;
    const next = sortedDateKeys.find((d) => d > selectedDateKey);
    if (!next) return;
    const nextParts = next.split('-').map(Number);
    const y = nextParts[0];
    const mo = nextParts[1];
    const day = nextParts[2];
    setViewYear(y);
    setViewMonth(mo - 1);
    setSelectedDateKey(next);
    const nextSlots = slotsByDate.get(next);
    if (nextSlots?.length) setSelectedSlot(nextSlots[0]);
  };

  const contactClinic = () => {
    if (doctor?.phone) {
      Linking.openURL(`tel:${doctor.phone.replace(/\s/g, '')}`);
    }
  };

  const submit = async () => {
    if (!selectedSlot) return;
    try {
      setSubmitting(true);
      setError(null);
      await appointmentsService.createPatientAppointment({
        slot_id: selectedSlot.id,
      });
      setSuccessVisible(true);
    } catch (err: unknown) {
      setError(formatApiError(err, 'Unable to confirm. Try another slot.'));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)' as never);
  };

  /** Header overlays content; scroll padding so first paint clears header, scroll moves content under it */
  const headerTopInset = insets.top;
  const headerBlockHeight = 76;

  if (loading || !doctorId) {
    return (
      <View className="flex-1 bg-coral-soft">
        <SafeAreaView className="flex-1 bg-coral-soft" edges={['top']}>
          <AppointmentScreenHeader onBack={goBack} />
          <CenteredScreenLoader />
        </SafeAreaView>
      </View>
    );
  }

  if (!doctor) {
    return (
      <View className="flex-1 bg-coral-soft">
        <SafeAreaView className="flex-1 bg-coral-soft" edges={['top']}>
          <AppointmentScreenHeader onBack={goBack} />
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-text-secondary">
              {error || 'Could not load this screen.'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (allSlots.length === 0) {
    return (
      <View className="flex-1 bg-coral-soft">
        <SafeAreaView className="flex-1 bg-coral-soft" edges={['top']}>
          <AppointmentScreenHeader onBack={goBack} />
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-text-secondary">
              {error || 'No open slots for this doctor yet. Check back later.'}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const bottomPad = Math.max(insets.bottom, 20);
  const scrollPaddingTop = headerTopInset + headerBlockHeight;
  const canConfirm = Boolean(selectedSlot && !noSlotsOnSelectedDay);

  return (
    <View className="flex-1 bg-coral-soft">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          paddingTop: scrollPaddingTop,
          paddingBottom: bottomPad + 8,
        }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View className="rounded-t-[28px] bg-white px-4 pb-6 pt-5 shadow-sm">
          {error ? (
            <View className="mb-4 rounded-2xl bg-error/10 p-3">
              <Text className="text-center text-sm text-error">{error}</Text>
            </View>
          ) : null}

          <AppointmentMonthCalendar
            viewYear={viewYear}
            viewMonth={viewMonth}
            panHandlers={monthSwipeResponder.panHandlers}
            onShiftMonth={shiftMonth}
            isDaySelected={(dayKey) => selectedDateKey === dayKey}
            onPressCalendarDay={onPressCalendarDay}
          />

          {noSlotsOnSelectedDay ? (
            <View className="mb-6 rounded-3xl border border-dashed border-border bg-bg-secondary p-5">
              <Text className="text-center text-base font-semibold text-text">No slots available</Text>
              <Text className="mt-2 text-center text-sm text-text-secondary">
                This day has no open times. Try another date or jump to the next day with openings.
              </Text>
              {nextAvailabilityLabel ? (
                <TouchableOpacity
                  onPress={goNextAvailability}
                  className="mt-4 items-center rounded-2xl bg-coral py-4 active:opacity-90"
                >
                  <Text className="text-center text-sm font-bold text-white">{nextAvailabilityLabel}</Text>
                </TouchableOpacity>
              ) : (
                <View className="mt-4 rounded-2xl bg-error/10 px-4 py-3">
                  <Text className="text-center text-sm font-semibold text-text">
                    No further openings in this schedule
                  </Text>
                  <Text className="mt-1 text-center text-xs leading-5 text-text-secondary">
                    There are no later dates with slots in the current booking window. Choose an earlier
                    date on the calendar or contact the clinic.
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={contactClinic}
                disabled={!doctor.phone}
                className={`mt-3 items-center rounded-2xl border border-coral py-4 ${
                  !doctor.phone ? 'opacity-40' : ''
                }`}
              >
                <Text className="text-sm font-bold text-coral-deep">Contact clinic</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text className="mb-3 text-base font-bold text-text">Available Time</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-8"
                contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                nestedScrollEnabled
              >
                {timesForSelectedDay.map((s) => {
                  const active = selectedSlot?.id === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSelectedSlot(s)}
                      className={`min-w-[76px] items-center justify-center rounded-full px-4 py-3 ${
                        active ? 'bg-coral' : 'bg-coral-soft'
                      }`}
                      activeOpacity={0.85}
                    >
                      <Text
                        className={`text-sm font-bold ${active ? 'text-white' : 'text-coral-deep'}`}
                      >
                        {s.display_time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text className="mb-3 mt-2 text-base font-bold text-text">Reminder Me Before</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                nestedScrollEnabled
              >
                {REMINDER_OPTIONS.map((m) => {
                  const active = reminderMinutes === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setReminderMinutes(m)}
                      className={`min-w-[76px] items-center justify-center rounded-full px-4 py-3 ${
                        active ? 'bg-coral' : 'bg-coral-soft'
                      }`}
                      activeOpacity={0.85}
                    >
                      <Text
                        className={`text-sm font-bold ${active ? 'text-white' : 'text-coral-deep'}`}
                      >
                        {m} Minit
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {canConfirm ? (
            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              className="mt-8 items-center rounded-2xl bg-coral py-4 active:opacity-90 disabled:opacity-70"
              activeOpacity={0.85}
            >
              <Text className="text-base font-bold text-white">
                {submitting ? 'Confirming…' : 'Confirm'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 top-0 z-50"
        style={{ elevation: Platform.OS === 'android' ? 24 : 0 }}
      >
        <SafeAreaView edges={['top']} className="bg-coral">
          <AppointmentScreenHeader onBack={goBack} />
        </SafeAreaView>
      </View>

      <BookingSuccessModal
        visible={successVisible}
        doctorName={doctor.name}
        dateLine={confirmLine.dateLine}
        timeLine={confirmLine.timeLine}
        statusLabel="Confirmed"
        onDone={() => {
          setSuccessVisible(false);
          router.replace('/(tabs)/saved' as never);
        }}
      />
    </View>
  );
}
