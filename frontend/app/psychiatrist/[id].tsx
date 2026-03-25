import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
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
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Doctor Profile" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !doctor) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Doctor Profile" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-text-secondary text-center mb-4">
            {error || 'Doctor not found'}
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            Go Back
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Doctor Profile" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <Card className="mb-4 border border-border">
            <View className="items-center">
              <Avatar name={doctor.name} size="xl" className="mb-4" />
              <Text className="text-2xl font-bold text-text mb-1">
                {doctor.name}
              </Text>
              <Text className="text-base text-text-secondary mb-3">
                {doctor.specialization}
              </Text>
              <Text className="text-xs uppercase tracking-[1px] text-primary">
                {doctor.relationship?.is_selected
                  ? 'Assigned'
                  : doctor.relationship?.has_pending_request
                    ? 'Pending confirmation'
                    : doctor.accepting_patients === false
                      ? 'Not accepting patients'
                      : 'Available'}
              </Text>
            </View>
          </Card>

          <Card className="mb-4">
            <Text className="text-base font-semibold text-text mb-3">Contact</Text>
            <Text className="text-sm text-text-secondary mb-2">
              Email: {doctor.email || 'Not provided'}
            </Text>
            <Text className="text-sm text-text-secondary">
              Phone: {doctor.phone || 'Not provided'}
            </Text>
          </Card>

          <Card className="mb-5 bg-primary/5 border border-primary/20">
            <Text className="text-base font-semibold text-text mb-1">
              Relationship status
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {relationshipLabel}
            </Text>
          </Card>

          {role === 'patient' &&
            !doctor.relationship?.is_selected &&
            !doctor.relationship?.has_pending_request &&
            doctor.accepting_patients !== false && (
              <Button
                onPress={handleRequest}
                loading={submitting}
                fullWidth
                className="mb-3"
              >
                Request this doctor
              </Button>
            )}

          <Button
            variant="outline"
            onPress={() => router.push(`/appointments/book?doctor_id=${doctor.id}` as any)}
            fullWidth
          >
            Book appointment
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
