import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { colors } from '@/constants/colors';
import { authService, type UserRole } from '@/services/auth';
import { doctorsService, type Doctor } from '@/services/doctors';

export default function PsychiatristDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [role, setRole] = useState<UserRole | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDoctor = async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await authService.getCurrentUser();
      setRole(currentUser?.role ?? null);
      const doctorData = await doctorsService.getDoctor(id as string);
      setDoctor(doctorData);
    } catch (err: any) {
      console.error('Error loading doctor:', err);
      setError(err.message || 'Failed to load doctor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctor();
  }, [id]);

  const handleRequest = async () => {
    if (!doctor) return;
    try {
      setSubmitting(true);
      await doctorsService.requestAssignment(doctor.id);
      await loadDoctor();
      Alert.alert(
        'Request sent',
        'The doctor will now see your confirmation request.',
      );
    } catch (err: any) {
      Alert.alert('Unable to send request', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Doctor profile" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !doctor) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Doctor profile" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-sm border-border/80">
            <View className="items-center py-1">
              <View className="w-12 h-12 rounded-2xl bg-error/10 items-center justify-center mb-3 border border-error/20">
                <Ionicons name="alert-circle-outline" size={28} color={colors.status.error} />
              </View>
              <Text className="text-base text-text-secondary text-center leading-6">
                {error || 'Doctor not found'}
              </Text>
            </View>
          </Card>
          <Button variant="outline" onPress={() => router.back()} className="mt-6 min-w-[200px]">
            Go back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const relationshipLabel = doctor.relationship?.is_selected
    ? 'You are linked to this doctor.'
    : doctor.relationship?.has_pending_request
      ? 'Your request is waiting for doctor confirmation.'
      : doctor.accepting_patients === false
        ? 'This doctor is not accepting new patients.'
        : 'You can request this doctor from here.';

  const statusLabel = doctor.relationship?.is_selected
    ? 'Assigned'
    : doctor.relationship?.has_pending_request
      ? 'Pending confirmation'
      : doctor.accepting_patients === false
        ? 'Not accepting patients'
        : 'Available';

  const canRequest =
    role === 'patient' &&
    !doctor.relationship?.is_selected &&
    !doctor.relationship?.has_pending_request &&
    doctor.accepting_patients !== false;

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header title="Doctor profile" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-coral px-6 pt-4 pb-7 rounded-b-[28px] mb-5 shadow-sm">
          <View className="items-center">
            <Avatar name={doctor.name} size="xl" className="mb-3 border-2 border-white/60" />
            <Text className="text-2xl font-bold text-coral-ink text-center mb-1">{doctor.name}</Text>
            <Text className="text-base text-coral-ink/80 text-center mb-3">{doctor.specialization}</Text>
            <View className="px-3 py-1 rounded-full bg-white/55">
              <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep">
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6">
          <Card className="mb-4 border-coral-soft bg-surface-soft">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral-deep mb-3">
              Contact
            </Text>
            <View className="mb-3">
              <Text className="text-xs text-text-secondary mb-0.5">Email</Text>
              <Text className="text-base text-text">{doctor.email || 'Not provided'}</Text>
            </View>
            <View>
              <Text className="text-xs text-text-secondary mb-0.5">Phone</Text>
              <Text className="text-base text-text">{doctor.phone || 'Not provided'}</Text>
            </View>
          </Card>

          <Card className="mb-5 bg-white border-coral-soft shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-coral-deep mb-2">
              Relationship
            </Text>
            <Text className="text-base font-semibold text-text mb-2 tracking-tight">Care link status</Text>
            <Text className="text-sm text-text-secondary leading-6">{relationshipLabel}</Text>
          </Card>

          {canRequest ? (
            <Button onPress={handleRequest} loading={submitting} fullWidth className="mb-3">
              Request this doctor
            </Button>
          ) : null}

          <Button
            variant={canRequest ? 'outline' : 'primary'}
            onPress={() => router.push(`/appointments/book?doctor_id=${doctor.id}` as any)}
            fullWidth
            className={canRequest ? '' : 'mb-0'}
          >
            Book appointment
          </Button>

          {role === 'patient' ? (
            <View className="mt-5 flex-row items-start rounded-2xl bg-surface-soft border border-coral-soft px-4 py-3 shadow-sm">
              <Ionicons name="information-circle-outline" size={20} color={colors.coral.deep} style={{ marginTop: 2 }} />
              <Text className="flex-1 ml-3 text-sm text-text-secondary leading-5">
                Booked visits use live slots from this doctor&apos;s schedule. If you are not linked yet, confirm the
                relationship first when possible.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
