import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import ReportCard from '@/components/Card/ReportCard';
import { appointmentsService } from '@/services/appointments';
import type { Appointment } from '@/services/appointments';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import {
  reportsService,
  type ReportOverviewResponse,
} from '@/services/reports';
import Avatar from '@/components/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

const TAB_BAR_HEIGHT = 62;

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, refreshUser, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'appointments' | 'reports'>('appointments');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reportOverview, setReportOverview] = useState<ReportOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const listBottomPadding =
    28 + TAB_BAR_HEIGHT + Math.max(insets.bottom, 10);

  const loadRecords = useCallback(async () => {
    try {
      const currentUser = await refreshUser();
      const currentRole = currentUser?.role ?? null;
      const [appointmentRes, reportRes] = await Promise.all([
        currentRole === 'doctor'
          ? appointmentsService.getDoctorAppointments({ limit: 50 })
          : appointmentsService.getPatientAppointments({ limit: 50 }),
        currentRole === 'patient'
          ? reportsService.getPatientReportsOverview().catch(() => null)
          : Promise.resolve(null),
      ]);
      setAppointments(appointmentRes.items);
      setReportOverview(reportRes);
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    if (authLoading) return;
    loadRecords();
  }, [authLoading, loadRecords]);

  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading) {
        loadRecords();
      }
    }, [authLoading, loadRecords]),
  );

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-6 pb-4">
        <Card className="mb-5 bg-bg-secondary border-primary/12 shadow-sm">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
            Library
          </Text>
          <Text className="text-2xl font-bold text-text mb-1 tracking-tight">Records</Text>
          <Text className="text-sm text-text-secondary leading-6">
            Appointments and your report library in one place.
          </Text>
        </Card>
        <View
          className="flex-row bg-bg-secondary rounded-2xl p-1 border border-border/80"
          accessibilityRole="tablist"
        >
          {[
            ['appointments', 'Appointments'],
            ['reports', 'Reports'],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => setActiveTab(value as 'appointments' | 'reports')}
              className={`flex-1 min-h-[44px] rounded-lg items-center justify-center ${
                activeTab === value ? 'bg-primary' : ''
              }`}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === value }}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  activeTab === value ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === 'appointments' ? (
        <View className="flex-1">
          {/* Keep appointment design consistent for both doctor and patient */}
          <View className="flex-row items-center justify-between px-4 py-3 bg-background border-b border-border/80">
            <View className="w-11 h-11 items-center justify-center">
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </View>
            <Text className="flex-1 text-xl font-bold text-text tracking-tight" numberOfLines={1}>
              Appointments
            </Text>
            <View className="w-11 h-11" />
          </View>

          {appointments.length > 0 ? (
            <FlatList
              data={appointments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingLeft: 24,
                paddingRight: 24,
                paddingTop: 12,
                paddingBottom: listBottomPadding,
              }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const appointment = item as Appointment;
                const name =
                  appointment.counterpart_name ||
                  (role === 'doctor' ? appointment.patient_name : appointment.doctor_name) ||
                  'Appointment';

                const secondary = appointment.reason_for_visit || appointment.reason || '';
                const requestText =
                  String(secondary || '').toLowerCase().includes('request') ||
                  String(appointment.reason || '').toLowerCase().includes('request')
                    ? secondary
                    : null;

                const dateValue = appointment.display_date || 'Date';
                const timeValue = appointment.display_time || appointment.status || 'Time';

                const canReject = appointment.status === 'booked';

                return (
                  <View className="mb-3 rounded-[18px] border border-coral-soft bg-white px-4 py-4">
                    <View className="flex-row items-start">
                      <Avatar
                        name={name}
                        size="md"
                        className="mr-3 border-2 border-white/35"
                      />
                      <View className="flex-1 min-w-0">
                        <Text className="text-base font-semibold text-text" numberOfLines={1}>
                          {name}
                        </Text>
                        {secondary ? (
                          <Text className="text-sm text-text-secondary mt-1" numberOfLines={1}>
                            {secondary}
                          </Text>
                        ) : null}
                        {requestText ? (
                          <Text className="mt-2 text-sm font-semibold text-error leading-5">
                            {requestText}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View className="flex-row justify-between mt-3">
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
                          <Text className="ml-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                            Date
                          </Text>
                        </View>
                        <Text className="mt-1 text-sm text-text">{dateValue}</Text>
                      </View>
                      <View className="flex-1 items-end">
                        <View className="flex-row items-center">
                          <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
                          <Text className="ml-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                            Time
                          </Text>
                        </View>
                        <Text className="mt-1 text-sm text-text">{timeValue}</Text>
                      </View>
                    </View>

                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        className={`items-center rounded-2xl bg-success py-2 ${
                          role === 'doctor' ? 'flex-1' : 'w-full'
                        }`}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/appointments/${appointment.id}` as any)}
                      >
                        <Text className="text-sm font-semibold text-white">View Details</Text>
                      </TouchableOpacity>

                      {role === 'doctor' ? (
                        <TouchableOpacity
                          className={`flex-1 items-center rounded-2xl py-2 ${
                            canReject ? 'bg-error' : 'bg-error/50'
                          }`}
                          activeOpacity={0.85}
                          disabled={!canReject || actionLoadingId === appointment.id}
                          onPress={async () => {
                            try {
                              setActionLoadingId(appointment.id);
                              await appointmentsService.cancelDoctorAppointment(appointment.id);
                              await loadRecords();
                            } finally {
                              setActionLoadingId(null);
                            }
                          }}
                        >
                          <Text className="text-sm font-semibold text-white">Reject Request</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            <View style={{ paddingBottom: listBottomPadding }} className="px-6">
              <EmptyState
                title="No appointments yet"
                message={
                  role === 'patient'
                    ? 'Your confirmed and completed appointments will appear here.'
                    : 'Patient bookings will appear here.'
                }
              />
            </View>
          )}
        </View>
      ) : role === 'doctor' ? (
        <EmptyState
          title="Patient reports live in patient workspaces"
          message="Open the reports workspace and choose a patient to manage uploaded and generated reports."
          actionLabel="Open reports"
          onActionPress={() => router.push('/reports' as any)}
        />
      ) : (reportOverview?.uploaded_reports?.length ?? 0) > 0 ||
        (reportOverview?.generated_reports?.length ?? 0) > 0 ? (
        <FlatList
          data={[
            ...(reportOverview?.uploaded_reports ?? []).map((item) => ({
              id: item.id,
              title: item.title,
              date: item.created_at,
              type: `uploaded • ${item.category.replace(/_/g, ' ')}`,
              preview: item.description || item.file_name,
              kind: 'uploaded' as const,
            })),
            ...(reportOverview?.generated_reports ?? []).map((item) => ({
              id: item.id,
              title: item.title,
              date: item.created_at,
              type: `generated • ${item.report_type.replace(/_/g, ' ')}`,
              preview: item.summary || 'Generated summary available',
              kind: 'generated' as const,
            })),
          ]}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
          renderItem={({ item }) => (
            <View className="px-6">
              <ReportCard
                title={item.title}
                date={new Date(item.date).toLocaleDateString()}
                type={item.type}
                preview={item.preview}
                onPress={() =>
                  router.push({
                    pathname: '/reports/[id]',
                    params: { id: item.id, kind: item.kind },
                  } as any)
                }
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState
          title="No reports yet"
          message="Uploaded documents and generated reports will appear here."
        />
      )}
    </SafeAreaView>
  );
}
