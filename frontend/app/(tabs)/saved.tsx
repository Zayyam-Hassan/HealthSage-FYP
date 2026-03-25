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
import { reportsService, type Report } from '@/services/reports';

export default function SavedScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<'appointments' | 'reports'>('appointments');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setRole(currentUser?.role ?? null);
      const [appointmentRes, reportRes] = await Promise.all([
        appointmentsService.getAppointments({ limit: 50 }),
        reportsService.getReports({ limit: 50 }),
      ]);
      setAppointments(appointmentRes.items);
      setReports(reportRes.items);
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
        <Card className="mb-4 bg-primary/5 border border-primary/20">
          <Text className="text-xl font-bold text-text mb-1">Records</Text>
          <Text className="text-sm text-text-secondary">
            Review appointment requests and generated care reports in one place.
          </Text>
        </Card>
        <View className="flex-row bg-bg-secondary rounded-xl p-1">
          {[
            ['appointments', 'Appointments'],
            ['reports', 'Reports'],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => setActiveTab(value as 'appointments' | 'reports')}
              className={`flex-1 py-3 rounded-lg ${
                activeTab === value ? 'bg-primary' : ''
              }`}
            >
              <Text
                className={`text-center font-semibold ${
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
                  date={item.display_date || 'Pending confirmation'}
                  time={item.display_time || item.status}
                  doctorName={item.counterpart_name || 'Appointment request'}
                  specialty={item.reason}
                  status={
                    item.status === 'completed'
                      ? 'completed'
                      : item.status === 'rejected' || item.status === 'cancelled'
                        ? 'cancelled'
                        : 'upcoming'
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
                ? 'Your appointment requests and confirmations will appear here.'
                : 'Patient appointment requests and confirmations will appear here.'
            }
            actionLabel={role === 'patient' ? 'Request appointment' : undefined}
            onActionPress={role === 'patient' ? () => router.push('/appointments/book' as any) : undefined}
          />
        )
      ) : reports.length > 0 ? (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-6">
              <ReportCard
                title={item.title}
                date={new Date(item.generated_at).toLocaleDateString()}
                type={item.type}
                preview={
                  typeof item.content === 'object'
                    ? String(
                        (item.content as any).overview ||
                          (item.content as any).latest_risk_summary ||
                          (item.content as any).patient_friendly_title ||
                          'Care summary',
                      )
                    : String(item.content)
                }
                onPress={() => router.push(`/reports/${item.id}` as any)}
              />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyState
          title="No reports yet"
          message="Generated prediction and care guidance reports will appear here."
        />
      )}
    </SafeAreaView>
  );
}
