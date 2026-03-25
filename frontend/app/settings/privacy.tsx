import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Card from '@/components/Card';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Privacy Policy" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <Card>
            <Text className="text-xl font-bold text-text mb-4">
              Privacy Policy
            </Text>
            <Text className="text-sm text-text-secondary mb-4">
              Last updated: December 2024
            </Text>

            <Text className="text-base font-semibold text-text mb-2 mt-4">
              1. Information We Collect
            </Text>
            <Text className="text-base text-text-secondary mb-4 leading-6">
              We collect information that you provide directly to us, including
              personal information such as your name, email address, phone number,
              and health-related information when you use our services.
            </Text>

            <Text className="text-base font-semibold text-text mb-2 mt-4">
              2. How We Use Your Information
            </Text>
            <Text className="text-base text-text-secondary mb-4 leading-6">
              We use the information we collect to provide, maintain, and improve
              our services, process your appointments, communicate with you, and
              ensure the security of our platform.
            </Text>

            <Text className="text-base font-semibold text-text mb-2 mt-4">
              3. Information Sharing
            </Text>
            <Text className="text-base text-text-secondary mb-4 leading-6">
              We do not sell, trade, or rent your personal information to third
              parties. We may share your information only with healthcare providers
              you choose to connect with through our platform.
            </Text>

            <Text className="text-base font-semibold text-text mb-2 mt-4">
              4. Data Security
            </Text>
            <Text className="text-base text-text-secondary mb-4 leading-6">
              We implement appropriate technical and organizational measures to
              protect your personal information against unauthorized access,
              alteration, disclosure, or destruction.
            </Text>

            <Text className="text-base font-semibold text-text mb-2 mt-4">
              5. Your Rights
            </Text>
            <Text className="text-base text-text-secondary mb-4 leading-6">
              You have the right to access, update, or delete your personal
              information at any time. You can also opt-out of certain
              communications from us.
            </Text>

            <Text className="text-base font-semibold text-text mb-2 mt-4">
              6. Contact Us
            </Text>
            <Text className="text-base text-text-secondary mb-4 leading-6">
              If you have any questions about this Privacy Policy, please contact
              us at privacy@healthsage.com
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

