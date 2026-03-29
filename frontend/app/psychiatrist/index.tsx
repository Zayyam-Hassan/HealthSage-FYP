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
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import SearchBar from '@/components/searchbar';
import { colors } from '@/constants/colors';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { doctorsService, type Doctor } from '@/services/doctors';

export default function PsychiatristListScreen() {
  const router = useRouter();
  const { role, refreshUser, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    try {
      setError(null);
      await refreshUser();
      const response = await doctorsService.getDoctors({
        search: searchQuery || undefined,
        page: 1,
        limit: 50,
      });
      setDoctors(response.items);
    } catch (err: any) {
      console.error('Error loading doctors:', err);
      setError(err.message || 'Failed to load doctors');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUser, searchQuery]);

  useEffect(() => {
    if (authLoading) return;
    loadDoctors();
  }, [authLoading, loadDoctors]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        loadDoctors();
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filtered = useMemo(() => doctors, [doctors]);

  const requestDoctor = async (doctorId: string) => {
    try {
      await doctorsService.requestAssignment(doctorId);
      await loadDoctors();
      Alert.alert(
        'Request sent',
        'The doctor can now confirm the relationship from the patients panel.',
      );
    } catch (err: any) {
      Alert.alert('Unable to send request', err.message || 'Please try again.');
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title={role === 'patient' ? 'Find your doctor' : 'Doctors'} showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header title={role === 'patient' ? 'Find your doctor' : 'Doctors'} showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDoctors();
            }}
            tintColor={colors.coral.main}
            colors={[colors.coral.main]}
          />
        }
      >
        <View className="px-6 pt-6">
          <Card className="mb-5 bg-surface-soft border-coral-soft shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral-deep mb-2">
              {role === 'patient' ? 'Directory' : 'Care team'}
            </Text>
            <Text className="text-2xl font-bold text-text mb-1 tracking-tight leading-8">
              {role === 'patient' ? 'Browse the directory' : 'Clinician directory'}
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
              {role === 'patient'
                ? 'Search, open a profile, then request—your care status on Home stays separate.'
                : 'Open a profile to view contact details.'}
            </Text>
          </Card>

          <SearchBar
            placeholder="Search by name or specialization"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSearch={loadDoctors}
          />

          {error ? (
            <View className="mt-4 flex-row items-start rounded-2xl border border-error/25 bg-error/10 p-4">
              <Ionicons name="alert-circle-outline" size={22} color={colors.status.error} />
              <Text className="text-sm text-error flex-1 ml-3 leading-5">{error}</Text>
            </View>
          ) : null}

          <View className="mt-5 mb-3">
            <Text className="text-lg font-semibold text-text mb-1 tracking-tight">
              {role === 'patient' ? 'Matching clinicians' : 'All clinicians'}
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {role === 'patient'
                ? 'Coral accent marks each row—tap through for details and booking.'
                : 'Tap a row to open the full profile.'}
            </Text>
          </View>

          {filtered.length > 0 ? (
            filtered.map((doctor) => {
              const statusLabel = doctor.relationship?.is_selected
                ? 'Assigned'
                : doctor.relationship?.has_pending_request
                  ? 'Pending confirmation'
                  : doctor.accepting_patients === false
                    ? 'Not accepting'
                    : 'Available';

              return (
                <TouchableOpacity
                  key={doctor.id}
                  onPress={() => router.push(`/psychiatrist/${doctor.id}` as any)}
                  activeOpacity={0.85}
                >
                  <Card className="mb-3 border-coral-soft bg-white overflow-hidden pl-0">
                    <View className="flex-row">
                      <View className="w-1 bg-coral self-stretch" />
                      <View className="flex-1 flex-row items-start justify-between py-3 pr-3 pl-3">
                        <View className="flex-1 pr-3">
                          <Text className="text-lg font-semibold text-text mb-1 tracking-tight">
                            {doctor.name}
                          </Text>
                          <Text className="text-sm text-text-secondary mb-2">
                            {doctor.specialization}
                          </Text>
                          <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mt-1">
                            {statusLabel}
                          </Text>
                        </View>
                        {role === 'patient' &&
                          !doctor.relationship?.is_selected &&
                          !doctor.relationship?.has_pending_request &&
                          doctor.accepting_patients !== false && (
                            <TouchableOpacity
                              onPress={(event) => {
                                event.stopPropagation();
                                requestDoctor(doctor.id);
                              }}
                              className="px-4 py-2.5 rounded-2xl bg-coral-ink"
                            >
                              <Text className="text-sm font-semibold text-white">
                                Request
                              </Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyState
              title="No doctors found"
              message="Try a different search or refresh the directory."
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
