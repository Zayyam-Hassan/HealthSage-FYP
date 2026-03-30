import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Avatar from '@/components/Avatar';
import Header from '@/components/Header';
import { colors } from '@/constants/colors';
import { doctorsService, type Doctor } from '@/services/doctors';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-bg-secondary px-2 py-4">
      <Text className="text-center text-lg font-bold text-text">{value}</Text>
      <Text className="mt-1 text-center text-xs text-text-secondary">{label}</Text>
    </View>
  );
}

export default function DoctorDetailsScreen() {
  const router = useRouter();
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      setError(null);
      setLoading(true);
      const data = await doctorsService.getDoctor(doctorId);
      setDoctor(data);
    } catch (err: unknown) {
      setError(formatApiError(err, 'Could not load doctor profile.'));
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !doctorId) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Doctor details" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (error || !doctor) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Doctor details" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-text-secondary">{error || 'Doctor not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const patientCount =
    doctor.stats?.patient_count != null ? String(doctor.stats.patient_count) : '—';

  const servicesText =
    doctor.bio?.trim() ||
    'Consultation and follow-up care. Contact the clinic for specialty services and availability.';

  const contactClinic = () => {
    if (doctor.phone) {
      Linking.openURL(`tel:${doctor.phone.replace(/\s/g, '')}`);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header title="Doctor details" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        className="flex-1"
      >
        <View className="px-5 pt-4">
          <View className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
            <View className="flex-row">
              <Avatar name={doctor.name} size="xl" />
              <View className="ml-4 flex-1 justify-center">
                <Text className="text-xl font-bold text-text">{doctor.name}</Text>
                <Text className="mt-1 text-sm text-text-secondary">{doctor.specialization}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setFavorite((f) => !f)}
                className="h-10 w-10 items-center justify-center rounded-full bg-bg-secondary"
                accessibilityLabel={favorite ? 'Remove favorite' : 'Add favorite'}
              >
                <Ionicons
                  name={favorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={favorite ? colors.coral.deep : colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
            <Text className="mt-4 text-sm text-text-secondary">
              Session fees vary by visit type — confirm with the clinic when you book.
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/appointments/confirm-booking',
                  params: { doctorId: doctor.id },
                } as never)
              }
              className="mt-5 items-center rounded-2xl bg-coral-deep py-4 active:opacity-90"
              activeOpacity={0.85}
            >
              <Text className="text-base font-bold text-white">Book now</Text>
            </TouchableOpacity>
          </View>

          <View className="mb-6 flex-row gap-3">
            <StatBox label="Patients" value={patientCount} />
            <StatBox label="Care team" value={doctor.relationship?.is_selected ? 'Yes' : '—'} />
            <StatBox label="Accepting" value={doctor.accepting_patients !== false ? 'Yes' : '—'} />
          </View>

          <View className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
            <Text className="mb-3 text-base font-bold text-text">About & services</Text>
            {servicesText.split('\n').map((line, i) => (
              <View key={i} className="mb-2 flex-row">
                <Text className="mr-2 text-coral-deep">{i + 1}.</Text>
                <Text className="flex-1 text-sm leading-6 text-text-secondary">{line.trim()}</Text>
              </View>
            ))}
          </View>

          <View className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <View className="h-40 items-center justify-center bg-bg-secondary">
              <Ionicons name="location" size={40} color={colors.coral.deep} />
              <Text className="mt-2 text-center text-xs text-text-secondary px-4">
                {doctor.phone
                  ? 'Tap contact to reach the clinic for directions.'
                  : 'Location details are shared when your visit is confirmed.'}
              </Text>
            </View>
            {doctor.phone ? (
              <TouchableOpacity
                onPress={contactClinic}
                className="border-t border-border py-4"
              >
                <Text className="text-center text-sm font-semibold text-coral-deep">
                  Contact clinic
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
