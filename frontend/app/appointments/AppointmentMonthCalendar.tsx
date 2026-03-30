import React, { useMemo } from 'react';
import { PanResponder, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Copied from `confirm-booking.tsx` — keep in sync with patient screen. */
export function getCalendarGridMondayFirst(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay();
  const mondayIndex = (dayOfWeek + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayIndex; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const WEEKDAYS_MO = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function isCalendarDayBeforeToday(year: number, monthIndex: number, day: number) {
  const d = new Date(year, monthIndex, day);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < t;
}

/** First day of month that is today or later (local). Falls back to 1 if the whole month is in the past. */
export function firstSelectableDayInMonth(year: number, monthIndex: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let dd = 1; dd <= lastDay; dd += 1) {
    const c = new Date(year, monthIndex, dd);
    c.setHours(0, 0, 0, 0);
    if (c >= today) return dd;
  }
  return 1;
}

export type AppointmentMonthCalendarProps = {
  viewYear: number;
  viewMonth: number;
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  onShiftMonth: (delta: number) => void;
  isDaySelected: (dayKey: string) => boolean;
  onPressCalendarDay: (day: number) => void;
};

/**
 * Month navigator + weekday header + grid — same structure and classes as
 * `confirm-booking.tsx` (patient date picker).
 */
export default function AppointmentMonthCalendar({
  viewYear,
  viewMonth,
  panHandlers,
  onShiftMonth,
  isDaySelected,
  onPressCalendarDay,
}: AppointmentMonthCalendarProps) {
  const monthTitle = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [viewYear, viewMonth]);

  const calendarGrid = useMemo(
    () => getCalendarGridMondayFirst(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  return (
    <View {...panHandlers}>
      <View className="mb-2 overflow-hidden rounded-2xl bg-coral">
        <View className="flex-row items-center justify-between px-3 py-3">
          <TouchableOpacity
            onPress={() => onShiftMonth(-1)}
            className="h-10 w-10 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-white">{monthTitle}</Text>
          <TouchableOpacity
            onPress={() => onShiftMonth(1)}
            className="h-10 w-10 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-1 border-b border-border/60 pb-2">
        <View className="flex-row">
          {WEEKDAYS_MO.map((d) => (
            <Text
              key={d}
              className="w-[14.28%] text-center text-xs font-semibold text-text-secondary"
            >
              {d}
            </Text>
          ))}
        </View>
      </View>

      <View className="mb-6 flex-row flex-wrap">
        {calendarGrid.map((cell, idx) => {
          if (cell === null) {
            return <View key={`e-${idx}`} className="w-[14.28%] py-2" />;
          }
          const dayKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(cell).padStart(2, '0')}`;
          const selected = isDaySelected(dayKey);
          const isPast = isCalendarDayBeforeToday(viewYear, viewMonth, cell);
          return (
            <View key={idx} className="w-[14.28%] items-center py-2">
              <TouchableOpacity
                onPress={() => !isPast && onPressCalendarDay(cell)}
                disabled={isPast}
                className={`h-9 w-9 items-center justify-center rounded-full border ${
                  isPast
                    ? 'border-border/70 bg-bg-secondary opacity-50'
                    : selected
                      ? 'border-coral-deep bg-coral-muted'
                      : 'border-coral-soft bg-coral-soft'
                }`}
                activeOpacity={isPast ? 1 : 0.75}
              >
                <Text
                  className={`text-sm font-semibold ${
                    isPast
                      ? 'text-text-tertiary'
                      : selected
                        ? 'text-coral-ink'
                        : 'text-text-secondary'
                  }`}
                >
                  {cell}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}
