import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { UploadedReportCategory } from '@/services/reports';

export type ReportsRecordFilter = 'all' | UploadedReportCategory;

/** Short tab labels match Scheduling’s segmented control; full names via accessibility. */
const TYPE_OPTIONS: { key: ReportsRecordFilter; label: string; a11yLabel: string }[] = [
  { key: 'all', label: 'All', a11yLabel: 'All records' },
  { key: 'patient_sent', label: 'Patient', a11yLabel: 'Patient sent' },
  { key: 'doctor_sent', label: 'Doctor', a11yLabel: 'Doctor sent' },
  { key: 'system_generated', label: 'System', a11yLabel: 'System generated' },
];

type Props = {
  value: ReportsRecordFilter;
  onChange: (f: ReportsRecordFilter) => void;
};

/**
 * Segmented pill bar for record categories (Scheduling-style). Use below the header, not in the footer.
 */
export default function ReportsRecordFilterBar({ value, onChange }: Props) {
  return (
    <View className="flex-row rounded-[20px] border border-coral-soft bg-white p-1">
      {TYPE_OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={opt.a11yLabel}
            accessibilityState={{ selected: active }}
            className={`min-w-0 flex-1 rounded-2xl py-2.5 ${active ? 'bg-coral-soft' : ''}`}
          >
            <Text
              className={`text-center text-xs font-bold ${
                active ? 'text-coral-ink' : 'text-text-secondary'
              }`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
