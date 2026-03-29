import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppDialog from '@/components/AppDialog';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { images } from '@/constants/images';
import { authService } from '@/services/auth';
import type { UserRole } from '@/services/auth';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

export default function SignupScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const { dialog, hideDialog, showDialog } = useAppDialog();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignup = async () => {
    const newErrors: {
      username?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (loading) return;
    setLoading(true);

    try {
      const signupResponse = await authService.signup({
        username: username.trim(),
        email: email.trim(),
        password: password,
        role,
      });

      if (!signupResponse) {
        throw new Error('Failed to create account. Please try again.');
      }

      if (signupResponse.role === 'doctor' || signupResponse.role === 'patient') {
        showDialog('Signup successful', 'Your account has been created successfully.', [
          {
            label: 'Continue',
            onPress: async () => {
              await refreshUser();
              router.replace('/(tabs)');
            },
          },
        ]);
      } else {
        throw new Error('Unexpected user role received from server');
      }
    } catch (error: any) {
      showDialog(
        'Signup failed',
        error.message || error.detail || 'Failed to create account. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary">
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={hideDialog}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-5 py-8 items-center justify-center min-h-[480px]">
            <View className="w-full max-w-md bg-white rounded-3xl border border-border/90 px-6 py-9 shadow-sm">
              <View className="items-center mb-7">
                <Image
                  source={images.helpingImage2}
                  className="w-40 h-32 mb-5"
                  resizeMode="contain"
                />
                <Text className="text-3xl font-bold text-text mb-2 tracking-tight">
                  Create your account
                </Text>
                <Text className="text-sm text-text-secondary text-center px-1 leading-6">
                  Choose your role and complete the fields below.
                </Text>
              </View>

              <View className="flex-row bg-bg-secondary rounded-2xl p-1 mb-5 border border-border/80">
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setRole('patient')}
                  className={`flex-1 min-h-[44px] rounded-lg items-center justify-center ${
                    role === 'patient' ? 'bg-primary' : ''
                  }`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: role === 'patient' }}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      role === 'patient' ? 'text-white' : 'text-text-secondary'
                    }`}
                  >
                    Patient
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setRole('doctor')}
                  className={`flex-1 min-h-[44px] rounded-lg items-center justify-center ${
                    role === 'doctor' ? 'bg-primary' : ''
                  }`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: role === 'doctor' }}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      role === 'doctor' ? 'text-white' : 'text-text-secondary'
                    }`}
                  >
                    Doctor
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mb-4">
                <Input
                  type="text"
                  label="UserName"
                  placeholder="UserName"
                  value={username}
                  onChangeText={setUsername}
                  error={errors.username}
                  required
                />

                <Input
                  type="email"
                  label="Email"
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  error={errors.email}
                  required
                />

                <Input
                  type="password"
                  label="Password"
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  error={errors.password}
                  required
                />

                <Input
                  type="password"
                  label="Confirm Password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  error={errors.confirmPassword}
                  required
                />
              </View>

              <Button onPress={handleSignup} loading={loading} fullWidth className="mb-4">
                Create account
              </Button>

              <View className="flex-row justify-center items-center flex-wrap mt-4">
                <Text className="text-sm text-text-secondary">Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text className="text-sm font-semibold text-primary">Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
