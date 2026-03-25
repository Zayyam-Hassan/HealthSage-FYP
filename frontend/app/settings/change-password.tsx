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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';

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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
            <Card>
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
                    className={`flex-row items-center border-2 rounded-lg px-4 py-3 bg-background ${
                      errors[field.key] ? 'border-error' : 'border-border'
                    }`}
                  >
                    <TextInput
                      className="flex-1 text-base text-text"
                      placeholder={field.placeholder}
                      placeholderTextColor="#9CA3AF"
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

            <Card className="mt-4 bg-primary/5 border-primary/20">
              <View className="flex-row items-start">
                <Text className="text-2xl mr-3">Lock</Text>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text mb-2">
                    Password Security Tips
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
