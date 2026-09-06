import React from 'react';
import { Text, View } from 'react-native';
import type { UploadedReportCategory } from '@/services/reports';

/**
 * Capsule status chips aligned with Scheduling (e.g. CANCELLED / COMPLETED): soft fill, bold uppercase.
 */
const SHELL: Record<UploadedReportCategory, string> = {
  patient_sent: 'border-coral-soft bg-coral-soft',
  doctor_sent: 'border-primary/25 bg-primary/10',
  system_generated: 'border-success/20 bg-success/10',
};

const LABEL: Record<UploadedReportCategory, string> = {
  patient_sent: 'text-coral-deep',
  doctor_sent: 'text-coral-ink',
  system_generated: 'text-success',
};

type Props = {
  category: UploadedReportCategory;
  /** Uppercase, e.g. PATIENT SENT */
  label: string;
};

export default function ReportRecordStatusPill({ category, label }: Props) {
  return (
    <View className={`shrink-0 rounded-full border px-2.5 py-1 ${SHELL[category]}`}>
      <Text
        className={`text-[10px] font-bold uppercase tracking-wide ${LABEL[category]}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
