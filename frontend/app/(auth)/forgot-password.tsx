import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Header from '@/components/Header';
import { images } from '@/constants/images';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
      <SafeAreaView className="flex-1 bg-background">
        <Header showBack onBackPress={() => router.back()} />
        <View className="flex-1 px-6 py-8 justify-center items-center">
          <View className="items-center">
            <View className="w-24 h-24 bg-success/20 rounded-full items-center justify-center mb-6 shadow-md">
              <Text className="text-5xl">✓</Text>
            </View>
            <Text className="text-2xl font-bold text-text mb-4 text-center">
              Email Sent!
            </Text>
            <Text className="text-base text-text-secondary text-center mb-8">
              We&apos;ve sent a password reset link to{'\n'}
              <Text className="font-semibold">{email}</Text>
            </Text>
            <Button
              onPress={() => router.back()}
              fullWidth
              className="mb-4"
            >
              Back to Login
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
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
            <View className="items-center mb-8">
              <Image
                source={images.healthsageLogo}
                className="w-28 h-28 mb-6"
                resizeMode="contain"
              />
              <Text className="text-2xl font-bold text-text mb-2 text-center">
                Forgot Password?
              </Text>
              <Text className="text-base text-text-secondary text-center">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </Text>
            </View>

            <View className="mb-6">
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

            <Button
              onPress={handleSubmit}
              loading={loading}
              fullWidth
            >
              Send Reset Link
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

