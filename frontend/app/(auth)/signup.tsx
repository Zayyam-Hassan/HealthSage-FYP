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
import Button from '@/components/Button';
import Input from '@/components/Input';
import { images } from '@/constants/images';
import { authService } from '@/services/auth';
import type { UserRole } from '@/services/auth';

export default function SignupScreen() {
  const router = useRouter();
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
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  }>({ visible: false, title: '', message: '' });

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
        setDialog({
          visible: true,
          title: 'Signup successful',
          message: 'Your account has been created successfully.',
          actions: [{ label: 'Continue', onPress: () => router.replace('/(tabs)') }],
        });
      } else {
        throw new Error('Unexpected user role received from server');
      }
    } catch (error: any) {
      setDialog({
        visible: true,
        title: 'Signup failed',
        message: error.message || error.detail || 'Failed to create account. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FFF5F3]">
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={() => setDialog((current) => ({ ...current, visible: false }))}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 py-10 items-center">
            <View className="w-full max-w-md bg-white rounded-3xl shadow-lg px-6 py-8">
              <View className="items-center mb-6">
                <Image
                  source={images.helpingImage2}
                  className="w-40 h-32 mb-4"
                  resizeMode="contain"
                />
                <Text className="text-2xl font-bold text-[#FF7F7F] mb-1">
                  Create Your Account
                </Text>
                <Text className="text-xs text-gray-500">
                  Smarter Care Begins Here
                </Text>
              </View>

              {/* Role toggle */}
              <View className="flex-row bg-[#F8F3F1] rounded-xl p-1 mb-4">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRole('patient')}
                  className={`flex-1 h-10 rounded-lg items-center justify-center ${
                    role === 'patient' ? 'bg-[#FF9E9E]' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      role === 'patient' ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    Patient
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setRole('doctor')}
                  className={`flex-1 h-10 rounded-lg items-center justify-center ${
                    role === 'doctor' ? 'bg-[#FF9E9E]' : ''
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      role === 'doctor' ? 'text-white' : 'text-gray-700'
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

              <Button
                onPress={handleSignup}
                loading={loading}
                fullWidth
                className="mb-4 bg-[#FF9E9E]"
              >
                SignUp
              </Button>

              <View className="flex-row justify-center items-center mt-4">
                <Text className="text-[11px] text-gray-500">
                  Already Have An Account?{' '}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text className="text-[11px] text-[#FF7F7F] font-semibold">
                    Login
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
