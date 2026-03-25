import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { authService, type UserRole } from '@/services/auth';
import { doctorsService } from '@/services/doctors';
import { patientsService } from '@/services/patients';

export default function EditProfileScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    full_name: '',
    specialization: '',
    phone: '',
    bio: '',
    accepting_patients: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setRole(currentUser?.role ?? null);

        if (currentUser?.role === 'doctor') {
          const doctor = await doctorsService.getDoctorMe();
          setForm({
            display_name: currentUser.display_name,
            email: currentUser.email,
            full_name: '',
            specialization: doctor.specialization || '',
            phone: doctor.phone || '',
            bio: doctor.bio || '',
            accepting_patients: doctor.accepting_patients ?? true,
          });
        } else if (currentUser?.role === 'patient') {
          const patient = await patientsService.getMyPatientProfile();
          setForm({
            display_name: currentUser?.display_name || patient.full_name,
            email: currentUser?.email || '',
            full_name: patient.full_name || '',
            specialization: '',
            phone: '',
            bio: '',
            accepting_patients: true,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = (field: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.display_name.trim() || !form.email.trim()) {
      Alert.alert('Missing details', 'Name and email are required.');
      return;
    }

    try {
      setSaving(true);
      await authService.updateProfile({
        display_name: form.display_name.trim(),
        email: form.email.trim(),
        full_name: role === 'patient' ? form.full_name.trim() : undefined,
        specialization: role === 'doctor' ? form.specialization.trim() : undefined,
        phone: role === 'doctor' ? form.phone.trim() : undefined,
        bio: role === 'doctor' ? form.bio.trim() : undefined,
        accepting_patients: role === 'doctor' ? form.accepting_patients : undefined,
      });

      Alert.alert('Profile updated', 'Your information has been saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Unable to save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Edit Profile" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Header title="Edit Profile" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-6">
            <Card className="mb-5 bg-primary/5 border border-primary/20">
              <View className="items-center py-4">
                <Avatar name={form.display_name || 'User'} size="xl" className="mb-4" />
                <Text className="text-2xl font-bold text-text mb-1">
                  {role === 'doctor' ? 'Doctor profile' : 'Patient profile'}
                </Text>
                <Text className="text-sm text-text-secondary text-center leading-5">
                  Keep your profile aligned with the dashboard, appointments, and reports.
                </Text>
              </View>
            </Card>

            <Card className="mb-4">
              <Text className="text-base font-semibold text-text mb-4">Core details</Text>

              <Text className="text-sm font-medium text-text mb-2">Display name</Text>
              <TextInput
                className="mb-4 rounded-xl border border-border bg-background px-4 py-3 text-text"
                placeholder="Display name"
                placeholderTextColor="#9CA3AF"
                value={form.display_name}
                onChangeText={(value) => updateField('display_name', value)}
              />

              <Text className="text-sm font-medium text-text mb-2">Email</Text>
              <TextInput
                className="mb-4 rounded-xl border border-border bg-background px-4 py-3 text-text"
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={form.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(value) => updateField('email', value)}
              />

              {role === 'patient' ? (
                <>
                  <Text className="text-sm font-medium text-text mb-2">Patient name</Text>
                  <TextInput
                    className="rounded-xl border border-border bg-background px-4 py-3 text-text"
                    placeholder="Patient full name"
                    placeholderTextColor="#9CA3AF"
                    value={form.full_name}
                    onChangeText={(value) => updateField('full_name', value)}
                  />
                </>
              ) : null}
            </Card>

            {role === 'doctor' ? (
              <Card className="mb-4">
                <Text className="text-base font-semibold text-text mb-4">Practice details</Text>

                <Text className="text-sm font-medium text-text mb-2">Specialization</Text>
                <TextInput
                  className="mb-4 rounded-xl border border-border bg-background px-4 py-3 text-text"
                  placeholder="Specialization"
                  placeholderTextColor="#9CA3AF"
                  value={form.specialization}
                  onChangeText={(value) => updateField('specialization', value)}
                />

                <Text className="text-sm font-medium text-text mb-2">Phone</Text>
                <TextInput
                  className="mb-4 rounded-xl border border-border bg-background px-4 py-3 text-text"
                  placeholder="Phone number"
                  placeholderTextColor="#9CA3AF"
                  value={form.phone}
                  keyboardType="phone-pad"
                  onChangeText={(value) => updateField('phone', value)}
                />

                <Text className="text-sm font-medium text-text mb-2">Bio</Text>
                <TextInput
                  className="mb-4 min-h-[110px] rounded-xl border border-border bg-background px-4 py-3 text-text"
                  placeholder="Short professional bio"
                  placeholderTextColor="#9CA3AF"
                  value={form.bio}
                  multiline
                  textAlignVertical="top"
                  onChangeText={(value) => updateField('bio', value)}
                />

                <View className="flex-row items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                  <View className="flex-1 pr-4">
                    <Text className="text-sm font-semibold text-text">Accepting patients</Text>
                    <Text className="text-xs text-text-secondary mt-1">
                      Control whether new patients can request assignment.
                    </Text>
                  </View>
                  <Switch
                    value={form.accepting_patients}
                    onValueChange={(value) => updateField('accepting_patients', value)}
                  />
                </View>
              </Card>
            ) : null}

            <Button onPress={handleSave} loading={saving} fullWidth size="lg">
              Save changes
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
