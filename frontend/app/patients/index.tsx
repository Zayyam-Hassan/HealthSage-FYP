import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import Button from '@/components/Button';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { useFocusedPolling } from '@/src/shared/hooks/useFocusedPolling';
import PatientCard from '@/components/PatientCard';
import SearchBar from '@/components/searchbar';
import { colors } from '@/constants/colors';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import {
  doctorsService,
  type DoctorAssignmentRequest,
} from '@/services/doctors';
import { patientsService, type Patient } from '@/services/patients';

const PATIENTS_REFRESH_MS = 15_000;

export default function PatientsListScreen() {
  const router = useRouter();
  const { role, refreshUser, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<DoctorAssignmentRequest[]>([]);
  const [selfPatient, setSelfPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const currentUser = await refreshUser();
      const currentRole = currentUser?.role ?? null;

      if (currentRole === 'doctor') {
        const [patientsRes, requestsRes] = await Promise.all([
          doctorsService.getMyPatients(),
          doctorsService.getAssignmentRequests(),
        ]);
        setPatients(patientsRes.items);
        setRequests(requestsRes.items);
        setSelfPatient(null);
      } else {
        const patient = await patientsService.getMyPatientProfile();
        setSelfPatient(patient);
        setPatients(patient ? [patient] : []);
        setRequests([]);
      }
    } catch (err: any) {
      console.error('Error loading patients screen:', err);
      setError(err.message || 'Failed to load patients');
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
        void loadData();
      }
    }, [authLoading, loadData]),
  );

  useFocusedPolling(() => loadData(), PATIENTS_REFRESH_MS, !authLoading);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) {
      return patients;
    }

    const query = searchQuery.toLowerCase();
    return patients.filter(
      (patient) =>
        patient.full_name.toLowerCase().includes(query) ||
        patient.patient_id.toLowerCase().includes(query) ||
        patient.conditions.some((condition) =>
          condition.toLowerCase().includes(query),
        ),
    );
  }, [patients, searchQuery]);

  const handleRequestAction = async (
    requestId: string,
    action: 'accept' | 'reject',
  ) => {
    try {
      await doctorsService.respondToAssignmentRequest(requestId, action);
      await loadData();
    } catch (err: any) {
      Alert.alert(
        'Unable to update request',
        err.message || 'Please try again.',
      );
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header
          variant="coral"
          title="Patients"
          showBack
        />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header
        variant="coral"
        title={role === 'doctor' ? 'My Patients' : 'My Profile'}
        showBack
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary.main}
            colors={[colors.primary.main]}
          />
        }
      >
        <View className="px-6 pt-6">
          {role === 'doctor' ? (
            <View className="mb-5 overflow-hidden rounded-2xl border border-white/25 bg-coral shadow-sm">
              <View className="px-5 pt-5 pb-4">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                  Patient panel
                </Text>
                <Text className="mt-1 text-2xl font-bold tracking-tight text-white leading-8">
                  Patients
                </Text>
                <Text className="mt-1 text-sm text-white/90 leading-6">
                  Review assignments and confirmation requests.
                </Text>
              </View>
            </View>
          ) : (
            <Card className="mb-5 bg-bg-secondary border-primary/12 shadow-sm">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
                Your record
              </Text>
              <Text className="text-2xl font-bold text-text mb-1 tracking-tight leading-8">
                My profile
              </Text>
              <Text className="text-sm text-text-secondary leading-6">
                Your profile and care identifiers.
              </Text>
            </Card>
          )}

          <SearchBar
            placeholder={
              role === 'doctor'
                ? 'Search assigned patients'
                : 'Search your profile details'
            }
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {error ? (
            <View className="mt-4 flex-row items-start rounded-2xl border border-error/25 bg-error/10 p-4">
              <Ionicons name="alert-circle-outline" size={22} color={colors.status.error} />
              <Text className="text-sm text-error flex-1 ml-3 leading-5">{error}</Text>
            </View>
          ) : null}

          {role === 'doctor' && requests.length > 0 ? (
            <View className="mt-5">
              <Text className="text-lg font-semibold text-text mb-1 tracking-tight">
                Pending confirmations
              </Text>
              <Text className="text-sm text-text-secondary mb-4 leading-5">
                Accept or decline assignment requests from patients.
              </Text>
              {requests.map((request) => (
                <Card key={request.id} className="mb-3 border-border/80">
                  <Text className="text-base font-semibold text-text mb-1">
                    {request.patient?.full_name ?? 'Patient request'}
                  </Text>
                  <Text className="text-sm text-text-secondary mb-4">
                    {request.patient
                      ? `${request.patient.demographics.age} yrs · ${request.patient.gender}`
                      : 'Profile request'}
                  </Text>
                  <View className="flex-row">
                    <Button
                      variant="primary"
                      className="flex-1 mr-2"
                      onPress={() => handleRequestAction(request.id, 'accept')}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onPress={() => handleRequestAction(request.id, 'reject')}
                    >
                      Reject
                    </Button>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          <View className="mt-6 mb-3 flex-row items-center justify-between gap-3">
            <View className="flex-1 min-w-0">
              <Text className="text-lg font-semibold text-text">
                {role === 'doctor' ? 'Assigned patients' : 'Your patient profile'}
              </Text>
              <Text className="text-sm text-text-secondary mt-0.5">
                {role === 'doctor' ? 'Tap a row to open the full chart.' : 'Tap to review demographics and vitals.'}
              </Text>
            </View>
          </View>

          {filteredPatients.length > 0 ? (
            filteredPatients.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={{
                  id: patient.id,
                  name: patient.full_name,
                  age: patient.demographics.age,
                  gender: patient.demographics.gender,
                  conditions: patient.conditions,
                  riskClass: undefined,
                }}
                onPress={() => router.push(`/patients/${patient.id}` as any)}
              />
            ))
          ) : (
            <EmptyState
              title={role === 'doctor' ? 'No assigned patients yet' : 'Patient profile unavailable'}
              message={
                role === 'doctor'
                  ? 'Accept a request to start building your panel.'
                  : 'Complete your health profile so your doctor and predictions can use real data.'
              }
            />
          )}

          {role !== 'doctor' && selfPatient && (
            <TouchableOpacity
              className="mt-4"
              onPress={() => router.push('/assessment' as any)}
              activeOpacity={0.8}
            >
              <Card className="border-primary/15 bg-bg-card shadow-sm">
                <Text className="text-base font-semibold text-text mb-1 tracking-tight">
                  Update health assessment
                </Text>
                <Text className="text-sm text-text-secondary leading-5">
                  Add glucose, HbA1c, cholesterol, blood pressure, and lifestyle details.
                </Text>
              </Card>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
