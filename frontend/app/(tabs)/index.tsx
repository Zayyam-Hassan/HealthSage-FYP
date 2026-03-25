import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Card from '@/components/Card';
import Loader from '@/components/Loader';
import SearchBar from '@/components/searchbar';
import { appointmentsService, type Appointment } from '@/services/appointments';
import { authService, type UserRole } from '@/services/auth';
import {
  doctorsService,
  type Doctor,
  type DoctorAssignmentRequest,
} from '@/services/doctors';
import { patientsService, type Patient } from '@/services/patients';
import { reportsService, type Report } from '@/services/reports';

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  badge: string;
};

const patientQuickActions: QuickAction[] = [
  {
    id: 'assessment',
    title: 'Health Form',
    subtitle: 'Update glucose, vitals, and lifestyle data',
    route: '/assessment',
    badge: 'HF',
  },
  {
    id: 'appointments',
    title: 'Appointments',
    subtitle: 'Request a time with your assigned doctor',
    route: '/appointments',
    badge: 'AP',
  },
  {
    id: 'doctors',
    title: 'Choose Doctor',
    subtitle: 'Review available doctors and request one',
    route: '/psychiatrist',
    badge: 'DR',
  },
  {
    id: 'reports',
    title: 'Reports',
    subtitle: 'See your latest reports and notes',
    route: '/reports',
    badge: 'RP',
  },
];

const doctorQuickActions: QuickAction[] = [
  {
    id: 'patients',
    title: 'My Patients',
    subtitle: 'Review assigned patients and pending requests',
    route: '/patients',
    badge: 'PT',
  },
  {
    id: 'risk',
    title: 'Risk Dashboard',
    subtitle: 'Run prediction and explainability flows',
    route: '/risk',
    badge: 'RK',
  },
  {
    id: 'appointments',
    title: 'Appointments',
    subtitle: 'Track scheduled consultations',
    route: '/appointments',
    badge: 'AP',
  },
  {
    id: 'chatbot',
    title: 'Assistant',
    subtitle: 'Use the clinical assistant for patient support',
    route: '/chatbot',
    badge: 'AI',
  },
];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAppointmentDisplay(appointment: Appointment) {
  if (appointment.display_date && appointment.display_time) {
    return `${appointment.display_date} at ${appointment.display_time}`;
  }
  if (appointment.display_date) {
    return appointment.display_date;
  }
  if (appointment.scheduled_at) {
    return `${formatDate(appointment.scheduled_at)} at ${formatTime(appointment.scheduled_at)}`;
  }
  return 'Awaiting confirmation from the other side';
}

export default function HomeScreen() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [popularDoctors, setPopularDoctors] = useState<Doctor[]>([]);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<DoctorAssignmentRequest[]>([]);
  const [myProfile, setMyProfile] = useState<Patient | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const quickActions = userRole === 'doctor' ? doctorQuickActions : patientQuickActions;

  const loadData = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      const role = currentUser?.role ?? null;
      setUserRole(role);

      const appointmentPromise = appointmentsService.getAppointments({
        page: 1,
        limit: 5,
      });

      if (role === 'doctor') {
        const [appointmentRes, patientsRes, requestsRes] = await Promise.all([
          appointmentPromise,
          doctorsService.getMyPatients(),
          doctorsService.getAssignmentRequests(),
        ]);
        setAppointments(appointmentRes.items);
        setMyPatients(patientsRes.items);
        setRequests(requestsRes.items);
        setPopularDoctors([]);
        setMyProfile(null);
        setReports([]);
      } else {
        const [appointmentRes, doctorsRes, profile, reportsRes] = await Promise.all([
          appointmentPromise,
          doctorsService.getDoctors({ page: 1, limit: 6 }),
          patientsService.getMyPatientProfile().catch(() => null),
          reportsService.getReports({ page: 1, limit: 5 }),
        ]);
        setAppointments(appointmentRes.items);
        setPopularDoctors(doctorsRes.items);
        setMyProfile(profile);
        setReports(reportsRes.items);
        setMyPatients([]);
        setRequests([]);
      }
    } catch (error) {
      console.error('Failed to load home screen:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

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
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="bg-primary px-6 pt-6 pb-7 rounded-b-[28px]">
          <Text className="text-sm text-white/80 mb-2">
            {userRole === 'doctor' ? 'Doctor dashboard' : 'Patient dashboard'}
          </Text>
          <Text className="text-[28px] font-bold text-white mb-3">
            {userRole === 'doctor'
              ? 'Your care panel'
              : 'Welcome to Patient Dashboard'}
          </Text>
          <Text className="text-sm text-white/90 leading-5 mb-4">
            {userRole === 'doctor'
              ? 'Stay on top of assignments, risk review, and appointment planning.'
              : 'Update your health profile, choose a doctor, and keep your care journey in one place.'}
          </Text>
          <SearchBar placeholder="Search screens and records" />
        </View>

        <View className="px-6 pt-5">
          <Card className="mb-5 bg-primary/5 border border-primary/20">
            <Text className="text-xs uppercase tracking-[1px] text-text-secondary mb-2">
              {userRole === 'doctor' ? 'Today at a glance' : 'Care status'}
            </Text>
            {userRole === 'doctor' ? (
              <View className="flex-row flex-wrap justify-between">
                <View className="w-[48%] mb-3 bg-white rounded-2xl p-4">
                  <Text className="text-3xl font-bold text-text">
                    {myPatients.length}
                  </Text>
                  <Text className="text-sm text-text-secondary">Assigned patients</Text>
                </View>
                <View className="w-[48%] mb-3 bg-white rounded-2xl p-4">
                  <Text className="text-3xl font-bold text-text">
                    {requests.length}
                  </Text>
                  <Text className="text-sm text-text-secondary">Pending confirmations</Text>
                </View>
              </View>
            ) : (
              <View className="bg-white rounded-2xl p-4">
                <Text className="text-base font-semibold text-text mb-1">
                  {myProfile?.assignment.doctor
                    ? `Doctor: ${myProfile.assignment.doctor.name}`
                    : myProfile?.assignment.pending_request
                      ? 'Doctor request pending'
                      : 'No doctor assigned yet'}
                </Text>
                <Text className="text-sm text-text-secondary leading-5">
                  {myProfile?.assignment.doctor
                    ? `${myProfile.assignment.doctor.specialization} is linked to your profile.`
                    : myProfile?.assignment.pending_request
                      ? 'Your selected doctor still needs to confirm the relationship.'
                      : 'Pick a doctor from the directory to start the confirmation flow.'}
                </Text>
                {myProfile?.assignment.doctor ? (
                  <TouchableOpacity
                    onPress={() => router.push('/appointments/book' as any)}
                    className="self-start mt-4 px-4 py-2 rounded-xl bg-primary"
                  >
                    <Text className="text-sm font-semibold text-white">
                      Request appointment
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </Card>

          <Text className="text-xl font-bold text-text mb-3">Quick actions</Text>
          <View className="flex-row flex-wrap justify-between mb-5">
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                className="w-[48%] mb-4"
                activeOpacity={0.8}
                onPress={() => router.push(action.route as any)}
              >
                <Card className="min-h-[150px] justify-between border border-border">
                  <View className="w-11 h-11 rounded-2xl bg-primary/15 items-center justify-center mb-4">
                    <Text className="text-sm font-bold text-primary">{action.badge}</Text>
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-text mb-1">
                      {action.title}
                    </Text>
                    <Text className="text-sm text-text-secondary leading-5">
                      {action.subtitle}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>

          {userRole === 'doctor' && requests.length > 0 && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-bold text-text">Pending requests</Text>
                <TouchableOpacity onPress={() => router.push('/patients' as any)}>
                  <Text className="text-sm font-semibold text-primary">Manage all</Text>
                </TouchableOpacity>
              </View>
              {requests.slice(0, 2).map((request) => (
                <Card key={request.id} className="mb-3 border border-border">
                  <Text className="text-base font-semibold text-text mb-1">
                    {request.patient?.full_name ?? 'Patient request'}
                  </Text>
                  <Text className="text-sm text-text-secondary mb-3">
                    Requested on {formatDate(request.created_at)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/patients' as any)}
                    className="self-start px-4 py-2 rounded-xl bg-primary"
                  >
                    <Text className="text-sm font-semibold text-white">
                      Review request
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          )}

          {userRole === 'patient' && popularDoctors.length > 0 && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-bold text-text">Available doctors</Text>
                <TouchableOpacity onPress={() => router.push('/psychiatrist' as any)}>
                  <Text className="text-sm font-semibold text-primary">See all</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={popularDoctors}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingRight: 12 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => router.push(`/psychiatrist/${item.id}` as any)}
                    activeOpacity={0.8}
                    className="mr-3"
                  >
                    <Card className="w-[220px] border border-border">
                      <Text className="text-base font-semibold text-text mb-1">
                        {item.name}
                      </Text>
                      <Text className="text-sm text-text-secondary mb-3">
                        {item.specialization}
                      </Text>
                      <Text className="text-xs text-primary font-semibold uppercase">
                        {item.relationship?.is_selected
                          ? 'Assigned'
                          : item.relationship?.has_pending_request
                            ? 'Pending confirmation'
                            : 'Open for requests'}
                      </Text>
                    </Card>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {userRole === 'patient' && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-bold text-text">Latest reports</Text>
                <TouchableOpacity onPress={() => router.push('/reports' as any)}>
                  <Text className="text-sm font-semibold text-primary">View all</Text>
                </TouchableOpacity>
              </View>
              {reports.length === 0 ? (
                <Card>
                  <Text className="text-sm text-text-secondary">
                    Reports shared by your doctor will appear here.
                  </Text>
                </Card>
              ) : (
                reports.slice(0, 2).map((report) => (
                  <TouchableOpacity
                    key={report.id}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/reports/${report.id}` as any)}
                  >
                    <Card className="mb-3 border border-border">
                      <Text className="text-base font-semibold text-text mb-1">
                        {report.title}
                      </Text>
                      <Text className="text-sm text-text-secondary mb-2">
                        {formatDate(report.generated_at)}
                      </Text>
                      <Text className="text-sm text-text-secondary leading-5">
                        {String(
                          (report.content as any)?.latest_risk_summary ||
                            (report.content as any)?.overview ||
                            'Open this report to review the care summary.',
                        )}
                      </Text>
                    </Card>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <View className="mb-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xl font-bold text-text">Upcoming appointments</Text>
              <TouchableOpacity onPress={() => router.push('/appointments' as any)}>
                <Text className="text-sm font-semibold text-primary">View all</Text>
              </TouchableOpacity>
            </View>
            {appointments.length === 0 ? (
              <Card>
                <Text className="text-sm text-text-secondary">
                  No upcoming appointments scheduled yet.
                </Text>
              </Card>
            ) : (
              appointments.slice(0, 2).map((appointment) => (
                <Card key={appointment.id} className="mb-3 border border-border">
                  <Text className="text-base font-semibold text-text mb-1">
                    {appointment.reason || 'Consultation'}
                  </Text>
                  <Text className="text-sm text-text-secondary mb-1">
                    {getAppointmentDisplay(appointment)}
                  </Text>
                  <Text className="text-xs uppercase tracking-[1px] text-primary">
                    {appointment.status}
                  </Text>
                </Card>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
