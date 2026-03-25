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
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import SearchBar from '@/components/searchbar';
import { authService, type UserRole } from '@/services/auth';
import { doctorsService, type Doctor } from '@/services/doctors';

export default function PsychiatristListScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDoctors = async () => {
    try {
      setError(null);
      const currentUser = await authService.getCurrentUser();
      setRole(currentUser?.role ?? null);
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
  };

  useEffect(() => {
    loadDoctors();
  }, []);

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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Doctors" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Doctors" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadDoctors();
          }} />
        }
      >
        <View className="px-6 pt-4">
          <SearchBar
            placeholder="Search by name or specialization"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSearch={loadDoctors}
          />

          {error && (
            <View className="mt-4 p-4 bg-error/10 rounded-xl">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          )}

          <View className="mt-5 mb-3">
            <Text className="text-xl font-bold text-text mb-1">
              {role === 'patient' ? 'Available doctors' : 'Doctor directory'}
            </Text>
            <Text className="text-sm text-text-secondary">
              {role === 'patient'
                ? 'Choose one doctor. They must confirm before the link becomes active.'
                : 'Browse the current doctor records in the database.'}
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
                  <Card className="mb-3 border border-border">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-lg font-semibold text-text mb-1">
                          {doctor.name}
                        </Text>
                        <Text className="text-sm text-text-secondary mb-2">
                          {doctor.specialization}
                        </Text>
                        <Text className="text-xs uppercase tracking-[1px] text-primary">
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
                            className="px-4 py-2 rounded-xl bg-primary"
                          >
                            <Text className="text-sm font-semibold text-white">
                              Request
                            </Text>
                          </TouchableOpacity>
                        )}
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
