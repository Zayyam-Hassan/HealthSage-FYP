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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppDialog from '@/components/AppDialog';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { colors } from '@/constants/colors';
import { images } from '@/constants/images';
import { authService } from '@/services/auth';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { dialog, hideDialog, showDialog } = useAppDialog();

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
      }, {
        rememberSession: rememberMe,
      });

      if (!user) {
        throw new Error('Unable to log in. Please try again.');
      }

      if (user.role === 'doctor' || user.role === 'patient') {
        showDialog('Login successful', 'You have logged in successfully.', [
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
        showDialog(
          'Login failed',
          error?.message || error?.detail || 'Something went wrong. Please try again.',
        );
      }
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
                  source={images.helpingImage1}
                  className="w-40 h-32 mb-5"
                  resizeMode="contain"
                />
                <Text className="text-3xl font-bold text-text mb-2 tracking-tight">
                  Welcome back
                </Text>
                <Text className="text-sm text-text-secondary text-center px-1 leading-6">
                  Sign in to continue to your care workspace.
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
                passwordMode="current"
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
              <View className="mb-3 rounded-xl bg-error/10 px-3 py-2">
                <Text className="text-sm text-error text-left">{authError}</Text>
              </View>
            )}
              <View className="flex-row items-center justify-between mb-6">
                <TouchableOpacity
                  className="flex-row items-center min-h-[44px] pr-2"
                  onPress={() => setRememberMe((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View
                    className={`w-5 h-5 rounded-md border mr-2 items-center justify-center ${
                      rememberMe ? 'bg-primary border-primary' : 'bg-white border-border-medium'
                    }`}
                  >
                    {rememberMe ? (
                      <Ionicons name="checkmark" size={14} color={colors.primary.contrast} />
                    ) : null}
                  </View>
                  <Text className="text-sm text-text-secondary">Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password')}
                  activeOpacity={0.7}
                  className="min-h-[44px] justify-center py-2 pl-2"
                >
                  <Text className="text-sm font-semibold text-primary">
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              <Button onPress={handleLogin} loading={loading} fullWidth className="mb-4">
                Sign in
              </Button>

              <View className="flex-row justify-center items-center flex-wrap mt-1">
                <Text className="text-sm text-text-secondary">No account? </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/signup')}
                  activeOpacity={0.7}
                >
                  <Text className="text-sm font-semibold text-primary">Create account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
