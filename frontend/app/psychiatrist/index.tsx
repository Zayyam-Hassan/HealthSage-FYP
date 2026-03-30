import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Card from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import SearchBar from '@/components/searchbar';
import { colors } from '@/constants/colors';
import { images } from '@/constants/images';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { doctorsService, type Doctor } from '@/services/doctors';
import { navigateToConfirmBookingIfSlots } from '@/utils/bookingNavigation';

export default function PsychiatristListScreen() {
  const router = useRouter();
  const { dialog, hideDialog, showDialog } = useAppDialog();
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

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header
          variant="coral"
          title={role === 'patient' ? 'Find your doctor' : 'Doctors'}
          showBack
        />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={hideDialog}
      />
      <Header
        variant="coral"
        title={role === 'patient' ? 'Find your doctor' : 'Doctors'}
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
              loadDoctors();
            }}
            tintColor={colors.coral.main}
            colors={[colors.coral.main]}
          />
        }
      >
        <View className="px-6 pt-6">
          <View className="mb-5 overflow-hidden rounded-3xl border border-white/25 bg-coral px-4 py-4">
            <Image
              source={images.highlight}
              className="absolute -right-8 -top-8 h-40 w-40 opacity-20"
              resizeMode="contain"
            />
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75 mb-2">
              {role === 'patient' ? 'Specialist hunt' : 'Care team'}
            </Text>
            <Text className="text-3xl font-bold text-white mb-1 tracking-tight leading-9">
              {role === 'patient' ? 'Doctors OnBoard' : 'Clinician directory'}
            </Text>
            <Text className="text-sm text-white/90 leading-6">
              {role === 'patient'
                ? "Let's connect with a specialist"
                : 'Open a profile to view contact details.'}
            </Text>
          </View>

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
              {role === 'patient' ? 'Specialists for you' : 'All clinicians'}
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {role === 'patient'
                ? 'Tap any card for details and instant booking.'
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
                  <Card className="mb-3 border-border/60 bg-white">
                    <View className="flex-row items-start">
                      <Image
                        source={images.helpingImage1}
                        className="h-20 w-20 rounded-2xl bg-bg-secondary"
                        resizeMode="cover"
                      />
                      <View className="ml-3 flex-1 min-w-0">
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1 pr-2">
                            <Text className="text-[25px] leading-8 font-semibold text-text" numberOfLines={1}>
                              {doctor.name}
                            </Text>
                            <Text className="text-sm text-coral-deep" numberOfLines={1}>
                              {doctor.specialization}
                            </Text>
                          </View>
                          <Ionicons
                            name={
                              doctor.relationship?.is_selected || doctor.relationship?.has_pending_request
                                ? 'heart'
                                : 'heart-outline'
                            }
                            size={20}
                            color={
                              doctor.relationship?.is_selected || doctor.relationship?.has_pending_request
                                ? colors.status.error
                                : colors.text.tertiary
                            }
                          />
                        </View>
                        <Text className="mt-1 text-xs text-text-secondary">
                          {doctor.stats?.patient_count ?? 0} patient stories
                        </Text>
                        <Text className="mt-0.5 text-xs text-text-secondary">{statusLabel}</Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                          Location
                        </Text>
                        <Text className="text-sm text-text-secondary mt-0.5">Location not shared</Text>
                      </View>
                      {role === 'patient' &&
                      !doctor.relationship?.is_selected &&
                      !doctor.relationship?.has_pending_request &&
                      doctor.accepting_patients !== false ? (
                        <TouchableOpacity
                          onPress={(event) => {
                            event.stopPropagation();
                            void navigateToConfirmBookingIfSlots(router, doctor.id, showDialog);
                          }}
                          className="rounded-xl bg-primary px-6 py-2.5"
                        >
                          <Text className="text-sm font-semibold text-white">Book Now</Text>
                        </TouchableOpacity>
                      ) : (
                        <View className="rounded-xl bg-bg-secondary px-4 py-2.5">
                          <Text className="text-sm font-semibold text-text-secondary">
                            {doctor.relationship?.has_pending_request
                              ? 'Pending'
                              : doctor.relationship?.is_selected
                                ? 'Assigned'
                                : 'View Profile'}
                          </Text>
                        </View>
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
