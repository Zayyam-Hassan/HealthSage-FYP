import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '@/constants/colors';
import { images } from '@/constants/images';
import Card from '@/components/Card';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { appointmentsService, type Appointment } from '@/services/appointments';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import {
  doctorsService,
  type Doctor,
  type DoctorAssignmentRequest,
} from '@/services/doctors';
import { patientsService, type Patient } from '@/services/patients';

type IonIconName = React.ComponentProps<typeof Ionicons>['name'];

type WorkspaceLink = {
  id: string;
  title: string;
  route: string;
  icon: IonIconName;
};

/** Same destinations + copy as `app/dashboard` — compact title + description cards (patient home). */
type PatientDashboardLink = {
  id: string;
  title: string;
  description: string;
  route: string;
};

const patientDashboardLinks: PatientDashboardLink[] = [
  {
    id: 'assessment',
    title: 'Health form',
    description: 'Update glucose, HbA1c, vitals, and lifestyle details.',
    route: '/assessment',
  },
  {
    id: 'doctor',
    title: 'Choose doctor',
    description: 'Send a request to a doctor from the directory.',
    route: '/psychiatrist',
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Review your saved medical reports.',
    route: '/reports',
  },
  {
    id: 'appointments',
    title: 'Scheduling',
    description: 'Browse available slots and book instantly.',
    route: '/appointments',
  },
];

/** Single strip of destinations — avoids repeating the same routes in multiple card grids */
const doctorWorkspaceLinks: WorkspaceLink[] = [
  { id: 'patients', title: 'Patients', route: '/patients', icon: 'people-outline' },
  { id: 'appointments', title: 'Schedule', route: '/appointments', icon: 'calendar-outline' },
  { id: 'reports', title: 'Reports', route: '/reports', icon: 'document-text-outline' },
  { id: 'risk', title: 'Risk', route: '/risk', icon: 'pulse-outline' },
  { id: 'chatbot', title: 'Assistant', route: '/chatbot', icon: 'chatbubbles-outline' },
];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, role: userRole, refreshUser, isLoading: authLoading } = useAuth();
  const userDisplayName = user?.display_name?.trim() ?? '';
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [popularDoctors, setPopularDoctors] = useState<Doctor[]>([]);
  const [myPatients, setMyPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<DoctorAssignmentRequest[]>([]);
  const [myProfile, setMyProfile] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const currentUser = await refreshUser();
      const role = currentUser?.role ?? null;

      if (role === 'doctor') {
        const [patientsRes, requestsRes] = await Promise.all([
          doctorsService.getMyPatients(),
          doctorsService.getAssignmentRequests(),
        ]);
        setAppointments([]);
        setMyPatients(patientsRes.items);
        setRequests(requestsRes.items);
        setPopularDoctors([]);
        setMyProfile(null);
      } else {
        const [appointmentRes, doctorsRes, profile] = await Promise.all([
          appointmentsService.getPatientAppointments({ limit: 5 }),
          doctorsService.getDoctors({ page: 1, limit: 6 }),
          patientsService.getMyPatientProfile().catch(() => null),
        ]);
        setAppointments(appointmentRes.items);
        setPopularDoctors(doctorsRes.items);
        setMyProfile(profile);
        setMyPatients([]);
        setRequests([]);
      }
    } catch (error) {
      console.error('Failed to load home screen:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, loadData]);

  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading) {
        loadData();
      }
    }, [authLoading, loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const patientDiscoveryCarouselVisible =
    userRole === 'patient' &&
    popularDoctors.length > 0 &&
    !myProfile?.assignment.doctor;

  const upcomingPatientCount = appointments.filter((a) => a.status === 'booked').length;

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 62 + Math.max(insets.bottom, 10) + 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.coral.main}
            colors={[colors.coral.main]}
          />
        }
      >
        <View className="overflow-hidden rounded-b-[28px] bg-coral shadow-sm">
          <Image
            source={images.highlight}
            accessibilityIgnoresInvertColors
            className="absolute -right-8 -top-6 h-48 w-48 opacity-25"
            resizeMode="contain"
          />
          <View className="px-6 pt-7 pb-9">
            <View className="flex-row items-end justify-between">
              <View className="flex-1 min-w-0 pr-3">
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
                <Text className="text-sm text-coral-ink/80 leading-6 max-w-[300px]">
                  {userRole === 'doctor'
                    ? 'A calm overview of your panel, scheduling, and tools for today.'
                    : 'Your appointments, care team, and health tools—together in one place.'}
                </Text>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-white/30 px-3 py-1.5 border border-white/40">
                    <Text className="text-[11px] font-semibold text-coral-ink">
                      {userRole === 'doctor' ? 'Clinical focus' : 'Stay on track'}
                    </Text>
                  </View>
                  <View className="rounded-full bg-white/20 px-3 py-1.5">
                    <Text className="text-[11px] font-semibold text-coral-ink/90">
                      {userRole === 'doctor' ? 'Secure · organized' : 'Supportive care'}
                    </Text>
                  </View>
                </View>
              </View>
              <Image
                source={userRole === 'doctor' ? images.helpingImage1 : images.helpingImage2}
                accessibilityIgnoresInvertColors
                style={{ width: 112, height: 112 }}
                resizeMode="contain"
              />
            </View>
            <View className="mt-5 flex-row items-center justify-between rounded-2xl bg-white/25 border border-white/35 px-4 py-3">
              <View className="flex-row items-center flex-1 min-w-0 pr-3">
                <View className="w-10 h-10 rounded-2xl bg-white/60 items-center justify-center mr-3">
                  <Ionicons
                    name={userRole === 'doctor' ? 'medkit-outline' : 'heart-outline'}
                    size={22}
                    color={colors.coral.ink}
                  />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-coral-ink/70">
                    {userRole === 'doctor' ? 'Today' : 'Wellness'}
                  </Text>
                  <Text className="text-sm font-semibold text-coral-ink leading-5" numberOfLines={2}>
                    {userRole === 'doctor'
                      ? 'Review patients and upcoming visits from shortcuts below.'
                      : 'Book care, update your profile, and keep documents handy.'}
                  </Text>
                </View>
              </View>
              <Image
                source={images.healthsageLogo}
                accessibilityIgnoresInvertColors
                style={{ width: 96, height: 26 }}
                resizeMode="contain"
              />
            </View>
          </View>
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
                    {requests.length}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1">Pending requests</Text>
                </View>
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between">
                <View className="w-[48%] mb-0 bg-white rounded-[18px] p-4 border border-coral-soft">
                  <Text className="text-[11px] font-semibold uppercase tracking-wide text-coral-deep mb-1">
                    Care team
                  </Text>
                  <Text className="text-lg font-bold text-coral-ink leading-6" numberOfLines={2}>
                    {myProfile?.assignment.doctor
                      ? myProfile.assignment.doctor.name
                      : myProfile?.assignment.pending_request
                        ? 'Pending'
                        : '—'}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1 leading-5" numberOfLines={3}>
                    {myProfile?.assignment.doctor
                      ? myProfile.assignment.doctor.specialization
                      : myProfile?.assignment.pending_request
                        ? 'Waiting for your doctor to confirm.'
                        : 'No doctor linked yet.'}
                  </Text>
                </View>
                <View className="w-[48%] mb-0 bg-white rounded-[18px] p-4 border border-coral-soft">
                  <Text className="text-3xl font-bold text-coral-ink">
                    {upcomingPatientCount}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1">Booked visits</Text>
                  <Text className="text-xs text-text-tertiary mt-2 leading-4">
                    Count of upcoming appointments on your schedule.
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {userRole === 'doctor' ? (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-text mb-1">Clinical workspace</Text>
              <Text className="text-sm text-text-secondary mb-3 leading-5">
                Quick links for day-to-day doctor workflows.
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
            </View>
          ) : (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-text mb-1">Your workspace</Text>
              <Text className="text-sm text-text-secondary mb-3 leading-5">
                {patientDiscoveryCarouselVisible
                  ? 'Shortcuts match the patient dashboard—use the discovery strip below to pick a clinician.'
                  : 'Same layout as the doctor dashboard: tap a card to open health tools, scheduling, and more.'}
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {patientDashboardLinks.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(item.route as any)}
                    className="w-[48%] mb-4"
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.description}`}
                  >
                    <Card className="min-h-[152px] border-coral-soft bg-surface-soft flex flex-col justify-between">
                      <Text className="text-base font-semibold text-text tracking-tight">
                        {item.title}
                      </Text>
                      <Text className="text-sm text-text-secondary leading-5">{item.description}</Text>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
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

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
