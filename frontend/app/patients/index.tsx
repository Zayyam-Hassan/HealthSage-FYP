import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Button from '@/components/Button';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import PatientCard from '@/components/PatientCard';
import SearchBar from '@/components/searchbar';
import { authService, type UserRole } from '@/services/auth';
import {
  doctorsService,
  type DoctorAssignmentRequest,
} from '@/services/doctors';
import { patientsService, type Patient } from '@/services/patients';

export default function PatientsListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<DoctorAssignmentRequest[]>([]);
  const [selfPatient, setSelfPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const currentUser = await authService.getCurrentUser();
      const currentRole = currentUser?.role ?? null;
      setRole(currentRole);

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
  };

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Patients" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title={role === 'doctor' ? 'My Patients' : 'My Profile'} showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadData();
          }} />
        }
      >
        <View className="px-6 pt-4">
          <SearchBar
            placeholder={
              role === 'doctor'
                ? 'Search assigned patients'
                : 'Search your profile details'
            }
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {error && (
            <View className="mt-4 p-4 bg-error/10 rounded-xl">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          )}

          {role === 'doctor' && requests.length > 0 && (
            <View className="mt-5">
              <Text className="text-xl font-bold text-text mb-3">
                Pending confirmations
              </Text>
              {requests.map((request) => (
                <Card key={request.id} className="mb-3 border border-border">
                  <Text className="text-base font-semibold text-text mb-1">
                    {request.patient?.full_name ?? 'Patient request'}
                  </Text>
                  <Text className="text-sm text-text-secondary mb-4">
                    {request.patient?.patient_id ?? 'Profile request'}
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
          )}

          <View className="mt-5 mb-3 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-text">
              {role === 'doctor' ? 'Assigned patients' : 'Your patient profile'}
            </Text>
            {role === 'doctor' && (
              <Button
                variant="primary"
                size="sm"
                onPress={() => router.push('/patients/new' as any)}
              >
                Add patient
              </Button>
            )}
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
                  ? 'Accept a request or add a patient to start building your panel.'
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
              <Card className="border border-primary/20 bg-primary/5">
                <Text className="text-base font-semibold text-text mb-1">
                  Update health assessment
                </Text>
                <Text className="text-sm text-text-secondary">
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
