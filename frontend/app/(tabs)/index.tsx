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
import {
  reportsService,
  type ReportOverviewResponse,
} from '@/services/reports';
import {
  treatmentService,
  type PatientTreatmentOverview,
  type DoctorTreatmentPlan,
} from '@/services/treatment';

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
    subtitle: 'Browse live slots and book instantly',
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
    subtitle: 'Manage availability, slots, and bookings',
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

  const quickActions = userRole === 'doctor' ? doctorQuickActions : patientQuickActions;

  const loadData = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      const role = currentUser?.role ?? null;
      setUserRole(role);

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
              ? 'Stay on top of patients, generated slots, and confirmed bookings.'
              : 'Choose a doctor, book a live slot instantly, and keep your care journey in one place.'}
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
                    {appointments.filter((appointment) => appointment.status === 'booked').length}
                  </Text>
                  <Text className="text-sm text-text-secondary">Upcoming bookings</Text>
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
                    ? `${myProfile.assignment.doctor.specialization} is linked to your profile. Open scheduling to book instantly.`
                    : myProfile?.assignment.pending_request
                      ? 'Your selected doctor still needs to confirm the relationship.'
                      : 'Pick a doctor from the directory to start the confirmation flow.'}
                </Text>
                {myProfile?.assignment.doctor ? (
                  <TouchableOpacity
                    onPress={() => router.push('/appointments' as any)}
                    className="self-start mt-4 px-4 py-2 rounded-xl bg-primary"
                  >
                    <Text className="text-sm font-semibold text-white">
                      Book appointment
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

          {userRole === 'doctor' && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-bold text-text">Treatment plans</Text>
                <TouchableOpacity onPress={() => router.push('/patients' as any)}>
                  <Text className="text-sm font-semibold text-primary">Open patients</Text>
                </TouchableOpacity>
              </View>
              <Card className="border border-border">
                <Text className="text-base font-semibold text-text mb-1">
                  Doctor-authored treatment plans
                </Text>
                <Text className="text-sm text-text-secondary leading-5">
                  Open any assigned patient to save diagnosis context, medications, lifestyle guidance, and follow-up notes into one structured backend plan the patient and chatbot can both read.
                </Text>
              </Card>
            </View>
          )}

          {userRole === 'doctor' && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-bold text-text">Patient reports</Text>
                <TouchableOpacity onPress={() => router.push('/reports' as any)}>
                  <Text className="text-sm font-semibold text-primary">Open workspace</Text>
                </TouchableOpacity>
              </View>
              <Card className="border border-border">
                <Text className="text-base font-semibold text-text mb-1">
                  Uploaded and system-generated reports
                </Text>
                <Text className="text-sm text-text-secondary leading-5">
                  Pick an assigned patient to upload shared documents or create risk, treatment, and overview reports in clearly separate sections.
                </Text>
              </Card>
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
                <Text className="text-xl font-bold text-text">Doctor treatment plan</Text>
                <TouchableOpacity onPress={() => router.push('/patients' as any)}>
                  <Text className="text-sm font-semibold text-primary">My profile</Text>
                </TouchableOpacity>
              </View>
              {!activeDoctorTreatmentPlan ? (
                <Card className="border border-border">
                  <Text className="text-sm text-text-secondary leading-5">
                    Your doctor has not saved a structured treatment plan yet.
                  </Text>
                </Card>
              ) : (
                <Card className="border border-border">
                  <Text className="text-base font-semibold text-text mb-2">
                    {activeDoctorTreatmentPlan.assessment.diagnosis || 'Doctor treatment plan'}
                  </Text>
                  <Text className="text-xs uppercase tracking-[1px] text-success mb-3">
                    {activeDoctorTreatmentPlan.status}
                  </Text>
                  {activeDoctorTreatmentPlan.assessment.clinical_impression ? (
                    <View className="mb-3">
                      <Text className="text-sm font-semibold text-text">Clinical impression</Text>
                      <Text className="text-sm text-text-secondary leading-5">
                        {activeDoctorTreatmentPlan.assessment.clinical_impression}
                      </Text>
                    </View>
                  ) : null}
                  {activeDoctorTreatmentPlan.assessment.treatment_goal ? (
                    <View className="mb-3">
                      <Text className="text-sm font-semibold text-text">Treatment goal</Text>
                      <Text className="text-sm text-text-secondary leading-5">
                        {activeDoctorTreatmentPlan.assessment.treatment_goal}
                      </Text>
                    </View>
                  ) : null}
                  {activeDoctorTreatmentPlan.medications.length > 0 ? (
                    <View className="mb-3">
                      <Text className="text-sm font-semibold text-text mb-2">Medications</Text>
                      {activeDoctorTreatmentPlan.medications.map((medication) => (
                        <View key={medication.id} className="mb-3">
                          <Text className="text-sm font-semibold text-text">
                            {medication.medication_name}
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {medication.dosage} • {medication.frequency} • {medication.route}
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {medication.duration} • {medication.timing_instructions}
                          </Text>
                          {medication.special_instructions ? (
                            <Text className="text-sm text-text-secondary">
                              Note: {medication.special_instructions}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {[
                    ['Diet', activeDoctorTreatmentPlan.lifestyle_plan.diet_plan],
                    ['Exercise', activeDoctorTreatmentPlan.lifestyle_plan.exercise_plan],
                    ['Sleep', activeDoctorTreatmentPlan.lifestyle_plan.sleep_guidance],
                    ['Stress', activeDoctorTreatmentPlan.lifestyle_plan.stress_guidance],
                    ['Monitoring', activeDoctorTreatmentPlan.lifestyle_plan.monitoring_guidance],
                    ['Lifestyle note', activeDoctorTreatmentPlan.lifestyle_plan.general_lifestyle_note],
                    ['Follow-up', activeDoctorTreatmentPlan.assessment.follow_up_note],
                    ['Doctor note', activeDoctorTreatmentPlan.doctor_note],
                  ].map(([label, value]) =>
                    value ? (
                      <View key={label} className="mb-2">
                        <Text className="text-sm font-semibold text-text">{label}</Text>
                        <Text className="text-sm text-text-secondary leading-5">
                          {value}
                        </Text>
                      </View>
                    ) : null,
                  )}
                  <Text className="text-xs text-text-secondary mt-2">
                    Updated {formatDate(activeDoctorTreatmentPlan.updated_at)}
                    {activeDoctorTreatmentPlan.doctor_name
                      ? ` • ${activeDoctorTreatmentPlan.doctor_name}`
                      : ''}
                  </Text>
                </Card>
              )}
            </View>
          )}

          {userRole === 'patient' && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-bold text-text">Active treatment</Text>
                <TouchableOpacity onPress={() => router.push('/patients' as any)}>
                  <Text className="text-sm font-semibold text-primary">My profile</Text>
                </TouchableOpacity>
              </View>
              {(!treatmentOverview?.active_prescriptions?.length &&
                !treatmentOverview?.active_lifestyle_plans?.length) ? (
                <Card>
                  <Text className="text-sm text-text-secondary">
                    Your doctor has not added an active prescription or lifestyle plan yet.
                  </Text>
                </Card>
              ) : (
                <View>
                  {treatmentOverview?.active_prescriptions?.map((prescription) => (
                    <Card key={prescription.id} className="mb-3 border border-border">
                      <Text className="text-base font-semibold text-text mb-2">
                        Medication prescription
                      </Text>
                      <Text className="text-xs uppercase tracking-[1px] text-success mb-3">
                        {prescription.status}
                      </Text>
                      {prescription.medications.map((medication) => (
                        <View key={medication.id} className="mb-3">
                          <Text className="text-sm font-semibold text-text">
                            {medication.medication_name}
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {medication.dosage} • {medication.frequency} • {medication.route}
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {medication.duration} • {medication.timing_instructions}
                          </Text>
                          {medication.special_instructions ? (
                            <Text className="text-sm text-text-secondary">
                              Note: {medication.special_instructions}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                      <Text className="text-xs text-text-secondary">
                        Updated {formatDate(prescription.updated_at)}
                        {prescription.doctor_name ? ` • ${prescription.doctor_name}` : ''}
                      </Text>
                    </Card>
                  ))}
                  {treatmentOverview?.active_lifestyle_plans?.map((plan) => (
                    <Card key={plan.id} className="mb-3 border border-border">
                      <Text className="text-base font-semibold text-text mb-2">
                        Lifestyle plan
                      </Text>
                      <Text className="text-xs uppercase tracking-[1px] text-success mb-3">
                        {plan.status}
                      </Text>
                      {[
                        ['Diet', plan.diet_plan],
                        ['Exercise', plan.exercise_plan],
                        ['Sleep', plan.sleep_guidance],
                        ['Stress', plan.stress_guidance],
                        ['Monitoring', plan.monitoring_guidance],
                        ['Follow-up', plan.follow_up_note],
                      ].map(([label, value]) =>
                        value ? (
                          <View key={label} className="mb-2">
                            <Text className="text-sm font-semibold text-text">{label}</Text>
                            <Text className="text-sm text-text-secondary leading-5">
                              {value}
                            </Text>
                          </View>
                        ) : null,
                      )}
                      <Text className="text-xs text-text-secondary">
                        Updated {formatDate(plan.updated_at)}
                        {plan.doctor_name ? ` • ${plan.doctor_name}` : ''}
                      </Text>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}

          {userRole === 'patient' && (
            <View className="mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xl font-bold text-text">Reports</Text>
                <TouchableOpacity onPress={() => router.push('/reports' as any)}>
                  <Text className="text-sm font-semibold text-primary">View all</Text>
                </TouchableOpacity>
              </View>
              {(!reportOverview?.uploaded_reports?.length &&
                !reportOverview?.generated_reports?.length) ? (
                <Card>
                  <Text className="text-sm text-text-secondary">
                    Uploaded documents and generated reports will appear here.
                  </Text>
                </Card>
              ) : (
                <View>
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
                    >
                      <Card className="mb-3 border border-border">
                        <Text className="text-base font-semibold text-text mb-1">
                          Uploaded report
                        </Text>
                        <Text className="text-sm font-semibold text-text">{report.title}</Text>
                        <Text className="text-sm text-text-secondary mt-1">
                          {report.category.replace(/_/g, ' ')} • {formatDate(report.created_at)}
                        </Text>
                      </Card>
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
                    >
                      <Card className="mb-3 border border-border">
                        <Text className="text-base font-semibold text-text mb-1">
                          Generated report
                        </Text>
                        <Text className="text-sm font-semibold text-text">{report.title}</Text>
                        <Text className="text-sm text-text-secondary mt-1">
                          {formatDate(report.created_at)}
                        </Text>
                        <Text className="mt-2 text-sm text-text-secondary leading-5">
                          {report.summary || 'Open this report to review the structured summary.'}
                        </Text>
                      </Card>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {userRole === 'patient' &&
          doctorTreatmentHistory.filter((item) => item.status !== 'active').length > 0 ? (
            <View className="mb-5">
              <Text className="text-xl font-bold text-text mb-3">
                Doctor treatment history
              </Text>
              {doctorTreatmentHistory
                .filter((item) => item.status !== 'active')
                .slice(0, 3)
                .map((plan) => (
                  <Card key={plan.id} className="mb-3 border border-border">
                    <Text className="text-base font-semibold text-text">
                      {plan.assessment.diagnosis || 'Doctor treatment plan'}
                    </Text>
                    <Text className="text-sm text-text-secondary mt-1">
                      {plan.assessment.treatment_goal ||
                        plan.doctor_note ||
                        'Structured doctor-authored treatment record'}
                    </Text>
                    <Text className="text-xs uppercase tracking-[1px] text-warning mt-2">
                      {plan.status}
                    </Text>
                  </Card>
                ))}
            </View>
          ) : null}

          {userRole === 'patient' &&
          ((treatmentOverview?.prescription_history?.length ?? 0) > 1 ||
            (treatmentOverview?.lifestyle_history?.length ?? 0) > 1) ? (
            <View className="mb-5">
              <Text className="text-xl font-bold text-text mb-3">Recent treatment history</Text>
              {treatmentOverview?.prescription_history
                ?.filter((item) => item.status !== 'active')
                .slice(0, 2)
                .map((prescription) => (
                  <Card key={prescription.id} className="mb-3 border border-border">
                    <Text className="text-base font-semibold text-text">Prescription</Text>
                    <Text className="text-sm text-text-secondary mt-1">
                      {prescription.medications
                        .map((medication) => medication.medication_name)
                        .join(', ')}
                    </Text>
                    <Text className="text-xs uppercase tracking-[1px] text-warning mt-2">
                      {prescription.status}
                    </Text>
                  </Card>
                ))}
              {treatmentOverview?.lifestyle_history
                ?.filter((item) => item.status !== 'active')
                .slice(0, 1)
                .map((plan) => (
                  <Card key={plan.id} className="mb-3 border border-border">
                    <Text className="text-base font-semibold text-text">Lifestyle plan</Text>
                    <Text className="text-sm text-text-secondary mt-1">
                      {plan.follow_up_note || plan.general_note || 'Lifestyle guidance record'}
                    </Text>
                    <Text className="text-xs uppercase tracking-[1px] text-warning mt-2">
                      {plan.status}
                    </Text>
                  </Card>
                ))}
            </View>
          ) : null}

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
