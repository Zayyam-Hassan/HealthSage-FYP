import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '@/constants/colors';
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
import {
  reportsService,
  type ReportOverviewResponse,
} from '@/services/reports';
import {
  treatmentService,
  type PatientTreatmentOverview,
  type DoctorTreatmentPlan,
} from '@/services/treatment';

type IonIconName = React.ComponentProps<typeof Ionicons>['name'];

type WorkspaceLink = {
  id: string;
  title: string;
  route: string;
  icon: IonIconName;
};

/** Single strip of destinations — avoids repeating the same routes in multiple card grids */
const doctorWorkspaceLinks: WorkspaceLink[] = [
  { id: 'patients', title: 'Patients', route: '/patients', icon: 'people-outline' },
  { id: 'appointments', title: 'Schedule', route: '/appointments', icon: 'calendar-outline' },
  { id: 'reports', title: 'Reports', route: '/reports', icon: 'document-text-outline' },
  { id: 'risk', title: 'Risk', route: '/risk', icon: 'pulse-outline' },
  { id: 'chatbot', title: 'Assistant', route: '/chatbot', icon: 'chatbubbles-outline' },
];

/** Patient home: routes not duplicated in other sections (reports & scheduling live in their own blocks). */
const patientCareLinksFull: WorkspaceLink[] = [
  { id: 'assessment', title: 'Health form', route: '/assessment', icon: 'clipboard-outline' },
  { id: 'doctors', title: 'Find doctors', route: '/psychiatrist', icon: 'medkit-outline' },
];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getAppointmentDisplay(appointment: Appointment) {
  if (appointment.display_date && appointment.display_time) {
    return `${appointment.display_date} at ${appointment.display_time}`;
  }
  if (appointment.slot?.start_datetime) {
    return new Date(appointment.slot.start_datetime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return 'Scheduled';
}

export default function HomeScreen() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [popularDoctors, setPopularDoctors] = useState<Doctor[]>([]);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<DoctorAssignmentRequest[]>([]);
  const [myProfile, setMyProfile] = useState<Patient | null>(null);
  const [reportOverview, setReportOverview] = useState<ReportOverviewResponse | null>(null);
  const [treatmentOverview, setTreatmentOverview] =
    useState<PatientTreatmentOverview | null>(null);
  const [activeDoctorTreatmentPlan, setActiveDoctorTreatmentPlan] =
    useState<DoctorTreatmentPlan | null>(null);
  const [doctorTreatmentHistory, setDoctorTreatmentHistory] = useState<DoctorTreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      const role = currentUser?.role ?? null;
      setUserRole(role);
      setUserDisplayName(currentUser?.display_name?.trim() || '');

      if (role === 'doctor') {
        const [appointmentRes, patientsRes, requestsRes] = await Promise.all([
          appointmentsService.getDoctorAppointments({ limit: 5 }),
          doctorsService.getMyPatients(),
          doctorsService.getAssignmentRequests(),
        ]);
        setAppointments(appointmentRes.items);
        setMyPatients(patientsRes.items);
        setRequests(requestsRes.items);
        setPopularDoctors([]);
        setMyProfile(null);
        setReportOverview(null);
        setTreatmentOverview(null);
        setActiveDoctorTreatmentPlan(null);
        setDoctorTreatmentHistory([]);
      } else {
        const [
          appointmentRes,
          doctorsRes,
          profile,
          reportsRes,
          treatmentOverviewRes,
          activeTreatmentRes,
          treatmentHistoryRes,
        ] = await Promise.all([
          appointmentsService.getPatientAppointments({ limit: 5 }),
          doctorsService.getDoctors({ page: 1, limit: 6 }),
          patientsService.getMyPatientProfile().catch(() => null),
          reportsService.getPatientReportsOverview().catch(() => null),
          treatmentService.getPatientTreatmentOverview().catch(() => null),
          treatmentService.getPatientActiveDoctorTreatmentPlan().catch(() => ({ item: null })),
          treatmentService.getPatientDoctorTreatmentHistory().catch(() => ({ items: [] })),
        ]);
        setAppointments(appointmentRes.items);
        setPopularDoctors(doctorsRes.items);
        setMyProfile(profile);
        setReportOverview(reportsRes);
        setTreatmentOverview(treatmentOverviewRes);
        setActiveDoctorTreatmentPlan(activeTreatmentRes.item);
        setDoctorTreatmentHistory(treatmentHistoryRes.items);
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

  const patientDiscoveryCarouselVisible =
    userRole === 'patient' &&
    popularDoctors.length > 0 &&
    !myProfile?.assignment.doctor;

  const patientQuickLinks: WorkspaceLink[] = patientDiscoveryCarouselVisible
    ? [
        {
          id: 'assessment',
          title: 'Health form',
          route: '/assessment',
          icon: 'clipboard-outline',
        },
      ]
    : patientCareLinksFull;

  const renderUpcomingAppointments = () => (
    <View className="mb-5">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-semibold text-text">Appointments</Text>
          <Text className="text-sm text-text-secondary mt-0.5 leading-5">
            {userRole === 'doctor'
              ? 'Confirmed visits — open your schedule to manage slots and bookings.'
              : 'Upcoming visits — open scheduling to book or change.'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/appointments' as any)}
          accessibilityRole="button"
          accessibilityLabel={userRole === 'doctor' ? 'Open schedule' : 'Open scheduling'}
        >
          <Text className="text-sm font-semibold text-coral-deep">
            {userRole === 'doctor' ? 'Open schedule' : 'Open scheduling'}
          </Text>
        </TouchableOpacity>
      </View>
      {appointments.length === 0 ? (
        <Card className="border-coral-soft bg-surface-soft">
          <View className="flex-row items-start">
            <View className="w-11 h-11 rounded-2xl bg-coral-muted items-center justify-center mr-3">
              <Ionicons name="calendar-outline" size={22} color={colors.coral.ink} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-text mb-1">No upcoming visits</Text>
              <Text className="text-sm text-text-secondary leading-5">
                When you book an appointment, it will appear here with date and status.
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        appointments.slice(0, 2).map((appointment) => (
          <Card
            key={appointment.id}
            className="mb-3 border-coral-soft bg-white overflow-hidden pl-0"
          >
            <View className="flex-row">
              <View className="w-1.5 bg-coral self-stretch" />
              <View className="flex-1 py-3 pr-4 pl-3">
                <Text className="text-base font-semibold text-text mb-1">
                  {appointment.reason || 'Consultation'}
                </Text>
                <Text className="text-sm text-text-secondary mb-1">
                  {getAppointmentDisplay(appointment)}
                </Text>
                <Text className="text-xs uppercase tracking-[1px] text-coral-deep font-semibold">
                  {appointment.status}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </View>
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
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.coral.main}
            colors={[colors.coral.main]}
          />
        }
      >
        <View className="bg-coral px-6 pt-6 pb-8 rounded-b-[28px] shadow-sm">
          <Text
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral-ink/50 mb-1"
            accessibilityRole="text"
          >
            {userRole === 'doctor' ? 'Clinician workspace' : 'Your care'}
          </Text>
          <Text className="text-[26px] font-bold text-coral-ink leading-8 mb-2 tracking-tight">
            {userRole === 'doctor'
              ? userDisplayName
                ? `Hello, ${userDisplayName.split(/\s+/).filter(Boolean)[0] ?? userDisplayName}`
                : 'Care overview'
              : userDisplayName
                ? `Hi, ${userDisplayName.split(/\s+/).filter(Boolean)[0] ?? userDisplayName}`
                : 'Hi there'}
          </Text>
          <Text className="text-sm text-coral-ink/75 leading-6 mb-5 max-w-[340px]">
            {userRole === 'doctor'
              ? 'Patients, scheduling, and clinical tools in one calm place.'
              : 'Appointments, your team, and documents—organized in one view.'}
          </Text>
          <SearchBar
            placeholder="Search in the app…"
            className="bg-white/95 border-white/50 shadow-md"
          />
        </View>

        <View className="px-6 pt-6">
          <Card className="mb-6 bg-surface-soft border-coral-soft shadow-sm">
            <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-2">
              {userRole === 'doctor' ? 'At a glance' : 'Care status'}
            </Text>
            {userRole === 'doctor' ? (
              <View className="flex-row flex-wrap justify-between">
                <View className="w-[48%] mb-0 bg-white rounded-[18px] p-4 border border-coral-soft">
                  <Text className="text-3xl font-bold text-coral-ink">
                    {myPatients.length}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1">Assigned patients</Text>
                </View>
                <View className="w-[48%] mb-0 bg-white rounded-[18px] p-4 border border-coral-soft">
                  <Text className="text-3xl font-bold text-coral-ink">
                    {appointments.filter((appointment) => appointment.status === 'booked').length}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1">Booked visits</Text>
                </View>
              </View>
            ) : (
              <View className="bg-white rounded-[18px] p-4 border border-coral-soft">
                <Text className="text-base font-semibold text-text mb-1">
                  {myProfile?.assignment.doctor
                    ? `Care team · ${myProfile.assignment.doctor.name}`
                    : myProfile?.assignment.pending_request
                      ? 'Doctor request pending'
                      : 'No doctor assigned yet'}
                </Text>
                <Text className="text-sm text-text-secondary leading-5">
                  {myProfile?.assignment.doctor
                    ? `${myProfile.assignment.doctor.specialization} is linked. Use scheduling below when you are ready.`
                    : myProfile?.assignment.pending_request
                      ? 'Your selected doctor still needs to confirm the relationship.'
                      : 'Browse the directory and send a request to get started.'}
                </Text>
              </View>
            )}
          </Card>

          {userRole === 'doctor' ? (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-text mb-1">Clinical workspace</Text>
              <Text className="text-sm text-text-secondary mb-3 leading-5">
                Quick links—schedule and appointments list are grouped below to avoid repeating the same destinations.
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {doctorWorkspaceLinks.map((link) => (
                  <TouchableOpacity
                    key={link.id}
                    activeOpacity={0.88}
                    onPress={() => router.push(link.route as any)}
                    accessibilityRole="button"
                    accessibilityLabel={link.title}
                    className="w-[48%] mb-3"
                  >
                    <View className="rounded-[18px] bg-surface-soft border border-coral-soft px-3 py-3.5 items-center shadow-sm">
                      <View className="w-11 h-11 rounded-[14px] bg-coral-muted items-center justify-center mb-2">
                        <Ionicons name={link.icon} size={22} color={colors.coral.ink} />
                      </View>
                      <Text className="text-[11px] font-semibold text-text text-center leading-4">
                        {link.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {renderUpcomingAppointments()}
            </View>
          ) : (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-text mb-1">Next steps</Text>
              <Text className="text-sm text-text-secondary mb-3 leading-5">
                {patientDiscoveryCarouselVisible
                  ? 'Complete your health form—find a clinician from the discovery strip below; scheduling and documents stay in their own sections.'
                  : 'Health data and directory search—scheduling and documents have dedicated sections below.'}
              </Text>
              <View
                className={`flex-row gap-3 ${patientQuickLinks.length === 1 ? 'justify-start' : ''}`}
              >
                {patientQuickLinks.map((link) => (
                  <TouchableOpacity
                    key={link.id}
                    activeOpacity={0.88}
                    onPress={() => router.push(link.route as any)}
                    accessibilityRole="button"
                    accessibilityLabel={link.title}
                    className={
                      patientQuickLinks.length === 1 ? 'w-[48%] max-w-[220px]' : 'flex-1 min-w-0'
                    }
                  >
                    <View className="rounded-[18px] bg-surface-soft border border-coral-soft px-3 py-3.5 items-center shadow-sm">
                      <View className="w-11 h-11 rounded-[14px] bg-coral-muted items-center justify-center mb-2">
                        <Ionicons name={link.icon} size={22} color={colors.coral.ink} />
                      </View>
                      <Text className="text-[11px] font-semibold text-text text-center leading-4">
                        {link.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {renderUpcomingAppointments()}
            </View>
          )}

          {userRole === 'doctor' && requests.length > 0 && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-text">Pending requests</Text>
                <TouchableOpacity onPress={() => router.push('/patients' as any)}>
                  <Text className="text-sm font-semibold text-coral-deep">Manage all</Text>
                </TouchableOpacity>
              </View>
              {requests.slice(0, 2).map((request) => (
                <Card key={request.id} className="mb-3 border-coral-soft bg-surface-soft">
                  <Text className="text-base font-semibold text-text mb-1">
                    {request.patient?.full_name ?? 'Patient request'}
                  </Text>
                  <Text className="text-sm text-text-secondary mb-3">
                    Requested on {formatDate(request.created_at)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/patients' as any)}
                    className="self-start px-4 py-2.5 rounded-xl bg-coral-ink"
                  >
                    <Text className="text-sm font-semibold text-white">
                      Review request
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          )}

          {userRole === 'patient' &&
            popularDoctors.length > 0 &&
            !myProfile?.assignment.doctor && (
              <View className="mb-5">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1 pr-2">
                    <Text className="text-lg font-semibold text-text">Find your doctor</Text>
                    <Text className="text-sm text-text-secondary mt-0.5 leading-5">
                      Discovery—different from your care status above. Browse and request a link.
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/psychiatrist' as any)}>
                    <Text className="text-sm font-semibold text-coral-deep">See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={popularDoctors.slice(0, 4)}
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
                      <Card className="w-[220px] border-coral-soft bg-surface-soft">
                        <Text className="text-base font-semibold text-text mb-1">
                          {item.name}
                        </Text>
                        <Text className="text-sm text-text-secondary mb-3">
                          {item.specialization}
                        </Text>
                        <Text className="text-xs text-coral-deep font-semibold uppercase tracking-wide">
                          {item.relationship?.has_pending_request
                            ? 'Pending confirmation'
                            : item.accepting_patients === false
                              ? 'Not accepting'
                              : 'Open for requests'}
                        </Text>
                      </Card>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

          {userRole === 'patient' && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-text">Care & treatment</Text>
                {myProfile?.id ? (
                  <TouchableOpacity
                    onPress={() => router.push(`/patients/${myProfile.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Open full health record"
                  >
                    <Text className="text-sm font-semibold text-coral-deep">Full record</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => router.push('/patients' as any)}>
                    <Text className="text-sm font-semibold text-coral-deep">My profile</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Card className="border-coral-soft bg-surface-soft overflow-hidden">
                <View className="mb-4 pb-4 border-b border-border/60">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-1">
                    Doctor plan
                  </Text>
                  {!activeDoctorTreatmentPlan ? (
                    <Text className="text-sm text-text-secondary leading-5">
                      Your doctor has not saved a structured treatment plan yet.
                    </Text>
                  ) : (
                    <>
                      <Text className="text-base font-semibold text-text">
                        {activeDoctorTreatmentPlan.assessment.diagnosis || 'Treatment plan'}
                      </Text>
                      <Text className="text-xs uppercase tracking-[1px] text-success mt-1 mb-2">
                        {activeDoctorTreatmentPlan.status}
                      </Text>
                      {activeDoctorTreatmentPlan.assessment.clinical_impression ? (
                        <Text className="text-sm text-text-secondary leading-5" numberOfLines={4}>
                          {activeDoctorTreatmentPlan.assessment.clinical_impression}
                        </Text>
                      ) : activeDoctorTreatmentPlan.assessment.treatment_goal ? (
                        <Text className="text-sm text-text-secondary leading-5" numberOfLines={3}>
                          {activeDoctorTreatmentPlan.assessment.treatment_goal}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
                <View>
                  <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-2">
                    Active care
                  </Text>
                  {!treatmentOverview?.active_prescriptions?.length &&
                  !treatmentOverview?.active_lifestyle_plans?.length ? (
                    <Text className="text-sm text-text-secondary leading-5">
                      No active prescription or lifestyle plan from your care team yet.
                    </Text>
                  ) : (
                    <View>
                      {treatmentOverview?.active_prescriptions?.[0] ? (
                        <View className="mb-3">
                          <Text className="text-sm font-semibold text-text">Medication</Text>
                          <Text className="text-sm text-text-secondary mt-0.5">
                            {treatmentOverview.active_prescriptions[0].medications[0]
                              ? `${treatmentOverview.active_prescriptions[0].medications[0].medication_name} · ${treatmentOverview.active_prescriptions[0].status}`
                              : `Prescription · ${treatmentOverview.active_prescriptions[0].status}`}
                          </Text>
                          {treatmentOverview.active_prescriptions[0].medications.length > 1 ? (
                            <Text className="text-xs text-text-tertiary mt-1">
                              +{treatmentOverview.active_prescriptions[0].medications.length - 1}{' '}
                              more in your full record
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                      {treatmentOverview?.active_lifestyle_plans?.[0] ? (
                        <View>
                          <Text className="text-sm font-semibold text-text">Lifestyle</Text>
                          <Text className="text-sm text-text-secondary mt-0.5" numberOfLines={3}>
                            {treatmentOverview.active_lifestyle_plans[0].diet_plan ||
                              treatmentOverview.active_lifestyle_plans[0].follow_up_note ||
                              treatmentOverview.active_lifestyle_plans[0].exercise_plan ||
                              `Plan active · ${treatmentOverview.active_lifestyle_plans[0].status}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              </Card>
              {myProfile?.id &&
              (doctorTreatmentHistory.some((item) => item.status !== 'active') ||
                (treatmentOverview?.prescription_history?.filter((item) => item.status !== 'active')
                  .length ?? 0) > 0 ||
                (treatmentOverview?.lifestyle_history?.filter((item) => item.status !== 'active')
                  .length ?? 0) > 0) ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push(`/patients/${myProfile.id}` as any)}
                  className="mt-3 rounded-xl border border-coral-soft bg-white px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel="View past treatment history in health record"
                >
                  <Text className="text-sm font-semibold text-text">Past care history</Text>
                  <Text className="text-xs text-text-secondary mt-1 leading-5">
                    Earlier plans and prescriptions live in your full health record—open to review.
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {userRole === 'patient' && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-text">Reports & documents</Text>
                <TouchableOpacity onPress={() => router.push('/reports' as any)}>
                  <Text className="text-sm font-semibold text-coral-deep">Library</Text>
                </TouchableOpacity>
              </View>
              {(!reportOverview?.uploaded_reports?.length &&
                !reportOverview?.generated_reports?.length) ? (
                <Card className="border-coral-soft bg-surface-soft">
                  <Text className="text-sm text-text-secondary leading-5">
                    Uploads and generated summaries will appear here. Use the library link to add or
                    open files.
                  </Text>
                </Card>
              ) : (
                <Card padding="none" className="border-coral-soft bg-surface-soft overflow-hidden">
                  {reportOverview?.uploaded_reports?.slice(0, 1).map((report) => (
                    <TouchableOpacity
                      key={report.id}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: '/reports/[id]',
                          params: { id: report.id, kind: 'uploaded' },
                        } as any)
                      }
                      className="px-4 py-4 border-b border-border/50"
                    >
                      <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-1">
                        Uploaded
                      </Text>
                      <Text className="text-base font-semibold text-text">{report.title}</Text>
                      <Text className="text-sm text-text-secondary mt-1">
                        {report.category.replace(/_/g, ' ')} · {formatDate(report.created_at)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {reportOverview?.generated_reports?.slice(0, 1).map((report) => (
                    <TouchableOpacity
                      key={report.id}
                      activeOpacity={0.85}
                      onPress={() =>
                        router.push({
                          pathname: '/reports/[id]',
                          params: { id: report.id, kind: 'generated' },
                        } as any)
                      }
                      className="px-4 py-4"
                    >
                      <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-1">
                        Generated
                      </Text>
                      <Text className="text-base font-semibold text-text">{report.title}</Text>
                      <Text className="text-sm text-text-secondary mt-1">
                        {formatDate(report.created_at)}
                      </Text>
                      {report.summary ? (
                        <Text className="mt-2 text-sm text-text-secondary leading-5" numberOfLines={2}>
                          {report.summary}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </Card>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
