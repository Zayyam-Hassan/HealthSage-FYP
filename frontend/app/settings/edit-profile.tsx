import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { colors } from '@/constants/colors';
import { authService } from '@/services/auth';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { doctorsService } from '@/services/doctors';
import { patientsService } from '@/services/patients';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { resolveApiAssetUrl } from '@/utils/apiAssetUrl';

type PendingAvatar = {
  uri: string;
  file_name: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  file_data_base64: string;
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { user: authUser, role, isLoading: authLoading, refreshUser } = useAuth();
  const { dialog, hideDialog, showDialog } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
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
    if (authLoading) return;
    (async () => {
      try {
        if (!authUser) {
          return;
        }

        if (authUser.role === 'doctor') {
          const doctor = await doctorsService.getDoctorMe();
          setForm({
            display_name: authUser.display_name,
            email: authUser.email,
            full_name: '',
            specialization: doctor.specialization || '',
            phone: doctor.phone || '',
            bio: doctor.bio || '',
            accepting_patients: doctor.accepting_patients ?? true,
          });
        } else if (authUser.role === 'patient') {
          const patient = await patientsService.getMyPatientProfile();
          setForm({
            display_name: authUser.display_name || patient.full_name,
            email: authUser.email || '',
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
  }, [authLoading, authUser]);

  const updateField = (field: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const pickAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showDialog('Permission required', 'Photo library permission is required to choose a profile picture.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const mimeType =
        asset.mimeType === 'image/png' || asset.mimeType === 'image/webp'
          ? asset.mimeType
          : 'image/jpeg';

      if (!asset.base64) {
        showDialog('Unable to use photo', 'Please try selecting a different image.');
        return;
      }

      setPendingAvatar({
        uri: asset.uri,
        file_name: asset.fileName ?? `avatar-${Date.now()}.${mimeType.split('/')[1]}`,
        mime_type: mimeType,
        file_data_base64: asset.base64,
      });
    } catch (error: any) {
      showDialog('Unable to pick photo', error?.message || 'Please try again.');
    }
  };

  const handleSave = async () => {
    if (!form.display_name.trim() || !form.email.trim()) {
      showDialog('Missing details', 'Name and email are required.');
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

      if (pendingAvatar) {
        await authService.uploadAvatar(pendingAvatar);
      }

      await refreshUser();
      setPendingAvatar(null);

      showDialog('Profile updated', 'Your information has been saved successfully.', [
        { label: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      showDialog('Unable to save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header
          variant="coral"
          title="Edit profile"
          showBack
        />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  const storedAvatarUri = resolveApiAssetUrl(authUser?.avatar_url);
  const avatarSource = pendingAvatar
    ? { uri: pendingAvatar.uri }
    : storedAvatarUri
      ? { uri: storedAvatarUri }
      : undefined;

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
        title="Edit profile"
        showBack
      />
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
            <Card className="mb-5 bg-bg-secondary border-primary/12 shadow-sm">
              <View className="items-center py-4">
                <Avatar
                  source={avatarSource}
                  name={form.display_name || 'User'}
                  size="xl"
                  className="mb-4"
                />
                <TouchableOpacity
                  onPress={() => void pickAvatar()}
                  activeOpacity={0.85}
                  className="mb-4 rounded-full border border-primary/20 bg-primary/8 px-4 py-2"
                >
                  <Text className="text-sm font-semibold text-primary">
                    {pendingAvatar ? 'Change selected photo' : 'Choose profile photo'}
                  </Text>
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-text mb-1 tracking-tight">
                  {role === 'doctor' ? 'Doctor profile' : 'Patient profile'}
                </Text>
                <Text className="text-sm text-text-secondary text-center leading-5">
                  Keep your profile aligned with the dashboard, appointments, and reports.
                </Text>
              </View>
            </Card>

            <Card className="mb-4 border-border/80">
              <Text className="text-base font-semibold text-text mb-4 tracking-tight">Core details</Text>

              <Text className="text-sm font-medium text-text mb-2">Display name</Text>
              <TextInput
                className="mb-4 rounded-2xl border border-border/90 bg-background px-4 py-3.5 text-text"
                placeholder="Display name"
                placeholderTextColor={colors.text.tertiary}
                value={form.display_name}
                onChangeText={(value) => updateField('display_name', value)}
              />

              <Text className="text-sm font-medium text-text mb-2">Email</Text>
              <TextInput
                className="mb-4 rounded-2xl border border-border/90 bg-background px-4 py-3.5 text-text"
                placeholder="Email"
                placeholderTextColor={colors.text.tertiary}
                value={form.email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(value) => updateField('email', value)}
              />

              {role === 'patient' ? (
                <>
                  <Text className="text-sm font-medium text-text mb-2">Patient name</Text>
                  <TextInput
                    className="rounded-2xl border border-border/90 bg-background px-4 py-3.5 text-text"
                    placeholder="Patient full name"
                    placeholderTextColor={colors.text.tertiary}
                    value={form.full_name}
                    onChangeText={(value) => updateField('full_name', value)}
                  />
                </>
              ) : null}
            </Card>

            {role === 'doctor' ? (
              <Card className="mb-4 border-border/80">
                <Text className="text-base font-semibold text-text mb-4 tracking-tight">Practice details</Text>

                <Text className="text-sm font-medium text-text mb-2">Specialization</Text>
                <TextInput
                  className="mb-4 rounded-2xl border border-border/90 bg-background px-4 py-3.5 text-text"
                  placeholder="Specialization"
                  placeholderTextColor={colors.text.tertiary}
                  value={form.specialization}
                  onChangeText={(value) => updateField('specialization', value)}
                />

                <Text className="text-sm font-medium text-text mb-2">Phone</Text>
                <TextInput
                  className="mb-4 rounded-2xl border border-border/90 bg-background px-4 py-3.5 text-text"
                  placeholder="Phone number"
                  placeholderTextColor={colors.text.tertiary}
                  value={form.phone}
                  keyboardType="phone-pad"
                  onChangeText={(value) => updateField('phone', value)}
                />

                <Text className="text-sm font-medium text-text mb-2">Bio</Text>
                <TextInput
                  className="mb-4 min-h-[110px] rounded-2xl border border-border/90 bg-background px-4 py-3.5 text-text"
                  placeholder="Short professional bio"
                  placeholderTextColor={colors.text.tertiary}
                  value={form.bio}
                  multiline
                  textAlignVertical="top"
                  onChangeText={(value) => updateField('bio', value)}
                />

                <View className="flex-row items-center justify-between rounded-2xl border border-border/90 bg-background px-4 py-3.5">
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
