import React, { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AppointmentCard from '@/components/Card/AppointmentCard';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import ReportCard from '@/components/Card/ReportCard';
import { appointmentsService } from '@/services/appointments';
import { authService, type UserRole } from '@/services/auth';
import {
  reportsService,
  type ReportOverviewResponse,
} from '@/services/reports';

export default function SavedScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<'appointments' | 'reports'>('appointments');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reportOverview, setReportOverview] = useState<ReportOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      const currentRole = currentUser?.role ?? null;
      setRole(currentRole);
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
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadRecords();
    }, []),
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
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
        appointments.length > 0 ? (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="px-6">
                <AppointmentCard
                  date={item.display_date || 'Scheduled'}
                  time={item.display_time || item.status}
                  doctorName={item.counterpart_name || 'Appointment'}
                  specialty={item.reason}
                  status={
                    item.status === 'completed'
                      ? 'completed'
                      : item.status === 'cancelled'
                        ? 'cancelled'
                        : 'booked'
                  }
                  onPress={() => router.push(`/appointments/${item.id}` as any)}
                />
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState
            title="No appointments yet"
            message={
              role === 'patient'
                ? 'Your confirmed and completed appointments will appear here.'
                : 'Patient bookings and follow-up updates will appear here.'
            }
            actionLabel={role === 'patient' ? 'Open scheduling' : undefined}
            onActionPress={role === 'patient' ? () => router.push('/appointments' as any) : undefined}
          />
        )
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
