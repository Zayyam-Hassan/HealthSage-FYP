import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Header from '@/components/Header';
import { colors } from '@/constants/colors';
import { images } from '@/constants/images';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email');
      return;
    }

    setError('');
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setEmailSent(true);
    }, 1500);
  };

  if (emailSent) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary">
        <Header showBack onBackPress={() => router.back()} />
        <View className="flex-1 px-6 py-8 justify-center items-center">
          <Card className="w-full max-w-md border-border/80">
            <View className="items-center py-2">
              <View className="w-16 h-16 bg-success/12 rounded-2xl items-center justify-center mb-5 border border-success/20">
                <Ionicons name="checkmark-circle" size={36} color={colors.status.success} />
              </View>
              <Text className="text-2xl font-bold text-text mb-3 text-center tracking-tight">
                Check your email
              </Text>
              <Text className="text-sm text-text-secondary text-center mb-8 leading-6">
                We&apos;ve sent a password reset link to{'\n'}
                <Text className="font-semibold text-text">{email}</Text>
              </Text>
              <Button onPress={() => router.back()} fullWidth>
                Back to login
              </Button>
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary">
      <Header showBack onBackPress={() => router.back()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 py-8 justify-center">
            <Card className="border-border/90 shadow-sm">
              <View className="items-center mb-8">
                <Image
                  source={images.healthsageLogo}
                  className="w-24 h-24 mb-6"
                  resizeMode="contain"
                />
                <Text className="text-2xl font-bold text-text mb-2 text-center tracking-tight">
                  Forgot password?
                </Text>
                <Text className="text-sm text-text-secondary text-center leading-6 px-1">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </Text>
              </View>

              <View className="mb-2">
                <Input
                  type="email"
                  label="Email"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  error={error}
                  required
                />
              </View>

              <Button onPress={handleSubmit} loading={loading} fullWidth>
                Send reset link
              </Button>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
