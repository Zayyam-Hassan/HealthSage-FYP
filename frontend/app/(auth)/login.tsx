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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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

  const handleLogin = async () => {
    const newErrors: { email?: string; password?: string } = {};

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

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setAuthError(null);
    if (loading) return;
    setLoading(true);

    try {
      const user = await authService.login({
        email: email.trim(),
        password,
      });

      if (!user) {
        throw new Error('Unable to log in. Please try again.');
      }

      if (user.role === 'doctor' || user.role === 'patient') {
        setDialog({
          visible: true,
          title: 'Login successful',
          message: 'You have logged in successfully.',
          actions: [{ label: 'Continue', onPress: () => router.replace('/(tabs)') }],
        });
      } else {
        throw new Error('Unexpected user role received from server');
      }
    } catch (error: any) {
      // For typical invalid-credential errors, show a calm inline message
      const message = String(error?.message || error?.detail || '').toLowerCase();
      if (
        message.includes('invalid') ||
        message.includes('unauthorized') ||
        message.includes('incorrect') ||
        message.includes('credentials')
      ) {
        setAuthError('Failed login, check credentials');
      } else {
        setDialog({
          visible: true,
          title: 'Login failed',
          message: error?.message || error?.detail || 'Something went wrong. Please try again.',
        });
      }
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
            {/* Card */}
            <View className="w-full max-w-md bg-white rounded-3xl shadow-lg px-6 py-8">
              {/* Illustration */}
              <View className="items-center mb-6">
                <Image
                  source={images.helpingImage1}
                  className="w-40 h-32 mb-4"
                  resizeMode="contain"
                />
                <Text className="text-2xl font-bold text-[#FF7F7F] mb-1">
                  Welcome Back
                </Text>
                <Text className="text-xs text-gray-500">
                  Sign In To Access Your Dashboard.
                </Text>
              </View>

              {/* Fields */}
              <View className="mb-4">
              <Input
                type="email"
                label="Email"
                placeholder="Email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (authError) setAuthError(null);
                }}
                error={errors.email}
                required
              />

              <Input
                type="password"
                label="Password"
                placeholder="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (authError) setAuthError(null);
                }}
                error={errors.password}
                required
              />
            </View>
            {authError && (
              <View className="mb-3">
                <Text className="text-[11px] text-red-500 text-left">
                  {authError}
                </Text>
              </View>
            )}
              {/* Remember / Forgot */}
              <View className="flex-row items-center justify-between mb-6">
                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() => setRememberMe((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-4 h-4 rounded-[4px] border border-gray-400 mr-2 ${
                      rememberMe ? 'bg-[#FF9E9E] border-[#FF9E9E]' : 'bg-white'
                    }`}
                  />
                  <Text className="text-[11px] text-gray-600">
                    Remember Me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password')}
                  activeOpacity={0.7}
                >
                  <Text className="text-[11px] text-[#FF7F7F]">
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Button */}
              <Button
                onPress={handleLogin}
                loading={loading}
                fullWidth
                className="mb-4 bg-[#FF9E9E]"
              >
                Login
              </Button>

              {/* Footer link */}
              <View className="flex-row justify-center items-center mt-1">
                <Text className="text-[11px] text-gray-500">
                  Don&apos;t Have An Account?{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/signup')}
                  activeOpacity={0.7}
                >
                  <Text className="text-[11px] text-[#FF7F7F] font-semibold">
                    Signup
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
