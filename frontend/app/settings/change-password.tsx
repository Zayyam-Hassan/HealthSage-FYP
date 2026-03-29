import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import { colors } from '@/constants/colors';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!passwords.currentPassword.trim()) {
      nextErrors.currentPassword = 'Current password is required';
    }
    if (!passwords.newPassword.trim()) {
      nextErrors.newPassword = 'New password is required';
    } else if (passwords.newPassword.length < 8) {
      nextErrors.newPassword = 'Password must be at least 8 characters';
    }
    if (!passwords.confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Please confirm your password';
    } else if (passwords.newPassword !== passwords.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }
    if (passwords.currentPassword === passwords.newPassword) {
      nextErrors.newPassword =
        'New password must be different from current password';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChangePassword = () => {
    if (!validateForm()) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setPasswords({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setErrors({});
      alert('Password changed successfully!');
      router.back();
    }, 1500);
  };

  const updatePassword = (field: string, value: string) => {
    setPasswords({ ...passwords, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header title="Change Password" showBack />
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
            <Card className="border-border/80 shadow-sm">
              <Text className="text-base text-text-secondary mb-6 leading-6">
                For your security, please enter your current password and choose
                a new strong password.
              </Text>

              {[
                {
                  key: 'currentPassword',
                  label: 'Current Password',
                  placeholder: 'Enter current password',
                  visible: showPasswords.current,
                  toggle: () => togglePasswordVisibility('current'),
                },
                {
                  key: 'newPassword',
                  label: 'New Password',
                  placeholder: 'Enter new password',
                  visible: showPasswords.new,
                  toggle: () => togglePasswordVisibility('new'),
                },
                {
                  key: 'confirmPassword',
                  label: 'Confirm New Password',
                  placeholder: 'Confirm new password',
                  visible: showPasswords.confirm,
                  toggle: () => togglePasswordVisibility('confirm'),
                },
              ].map((field, index) => (
                <View
                  className={index === 2 ? 'mb-6' : 'mb-4'}
                  key={field.key}
                >
                  <Text className="text-sm font-medium text-text mb-2">
                    {field.label} <Text className="text-error">*</Text>
                  </Text>
                  <View
                    className={`flex-row items-center border rounded-2xl px-4 py-3.5 bg-background ${
                      errors[field.key] ? 'border-error' : 'border-border/90'
                    }`}
                  >
                    <TextInput
                      className="flex-1 text-base text-text"
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.text.tertiary}
                      value={passwords[field.key as keyof typeof passwords]}
                      onChangeText={(text) => updatePassword(field.key, text)}
                      secureTextEntry={!field.visible}
                      returnKeyType={index === 2 ? 'done' : 'next'}
                      {...(Platform.OS === 'android'
                        ? {
                            autoComplete: 'off' as any,
                            importantForAutofill: 'no' as any,
                          }
                        : {})}
                      {...(Platform.OS === 'ios'
                        ? { textContentType: 'none' as any }
                        : {})}
                    />
                    <TouchableOpacity onPress={field.toggle} className="ml-2">
                      <Text className="text-primary text-sm font-medium">
                        {field.visible ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {errors[field.key] ? (
                    <Text className="text-error text-sm mt-1">
                      {errors[field.key]}
                    </Text>
                  ) : null}
                  {field.key === 'newPassword' ? (
                    <Text className="text-xs text-text-tertiary mt-1">
                      Must be at least 8 characters long
                    </Text>
                  ) : null}
                </View>
              ))}

              <Button
                onPress={handleChangePassword}
                loading={loading}
                disabled={
                  !passwords.currentPassword ||
                  !passwords.newPassword ||
                  !passwords.confirmPassword
                }
                fullWidth
                size="lg"
              >
                Change Password
              </Button>
            </Card>

            <Card className="mt-4 bg-bg-secondary border-primary/12 shadow-sm">
              <View className="flex-row items-start">
                <View className="w-10 h-10 rounded-[14px] bg-primary/10 items-center justify-center mr-3 border border-primary/10">
                  <Ionicons name="lock-closed-outline" size={20} color={colors.primary.main} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text mb-2 tracking-tight">
                    Password security tips
                  </Text>
                  <Text className="text-xs text-text-secondary leading-5">
                    {'- Use a combination of letters, numbers, and special characters\n'}
                    {'- Avoid using personal information\n'}
                    {'- Do not reuse passwords from other accounts\n'}
                    {'- Change your password regularly'}
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
