import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Card from '@/components/Card';

export default function AboutScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header title="About" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          {/* App Info */}
          <Card className="mb-6 border-border/80 shadow-sm">
            <View className="items-center mb-6">
              <View className="w-24 h-24 bg-primary rounded-2xl items-center justify-center mb-4 border border-primary/20">
                <Text className="text-3xl font-bold text-white tracking-tight">HS</Text>
              </View>
              <Text className="text-2xl font-bold text-text mb-2 tracking-tight">
                HealthSage
              </Text>
              <Text className="text-base text-text-secondary mb-1">
                Version 1.0.0
              </Text>
              <Text className="text-sm text-text-tertiary">
                Build 2024.01.15
              </Text>
            </View>
          </Card>

          {/* Description */}
          <Card className="mb-6 border-border/80 shadow-sm">
            <Text className="text-lg font-semibold text-text mb-3 tracking-tight">
              About HealthSage
            </Text>
            <Text className="text-sm text-text-secondary leading-6 mb-4">
              HealthSage is your trusted healthcare companion, designed to help you manage your mental health and wellness journey. Our platform connects you with qualified psychiatrists and provides comprehensive health management tools.
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
              We are committed to providing accessible, confidential, and professional healthcare services to help you achieve better mental health and overall well-being.
            </Text>
          </Card>

          {/* Features */}
          <Card className="mb-6 border-border/80 shadow-sm">
            <Text className="text-lg font-semibold text-text mb-3 tracking-tight">
              Key Features
            </Text>
            <View className="space-y-3">
              <View className="flex-row items-start">
                <Text className="text-primary mr-3 mt-1">•</Text>
                <Text className="text-sm text-text-secondary flex-1 leading-5">
                  Connect with qualified psychiatrists
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-primary mr-3 mt-1">•</Text>
                <Text className="text-sm text-text-secondary flex-1 leading-5">
                  Book and manage appointments easily
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-primary mr-3 mt-1">•</Text>
                <Text className="text-sm text-text-secondary flex-1 leading-5">
                  Access your health reports and assessments
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-primary mr-3 mt-1">•</Text>
                <Text className="text-sm text-text-secondary flex-1 leading-5">
                  Get personalized health recommendations
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-primary mr-3 mt-1">•</Text>
                <Text className="text-sm text-text-secondary flex-1 leading-5">
                  Secure and confidential data handling
                </Text>
              </View>
            </View>
          </Card>

          {/* Contact */}
          <Card className="mb-6 border-border/80 shadow-sm">
            <Text className="text-lg font-semibold text-text mb-3 tracking-tight">
              Contact Us
            </Text>
            <View className="space-y-3">
              <View>
                <Text className="text-sm font-medium text-text-secondary mb-1">
                  Email
                </Text>
                <Text className="text-sm text-primary">
                  support@healthsage.com
                </Text>
              </View>
              <View>
                <Text className="text-sm font-medium text-text-secondary mb-1">
                  Phone
                </Text>
                <Text className="text-sm text-primary">
                  1-800-HEALTH-SAGE
                </Text>
              </View>
              <View>
                <Text className="text-sm font-medium text-text-secondary mb-1">
                  Website
                </Text>
                <Text className="text-sm text-primary">
                  www.healthsage.com
                </Text>
              </View>
            </View>
          </Card>

          {/* Legal */}
          <Card className="border-border/80 shadow-sm">
            <Text className="text-lg font-semibold text-text mb-3 tracking-tight">
              Legal Information
            </Text>
            <Text className="text-xs text-text-tertiary leading-5 mb-4">
              © 2024 HealthSage. All rights reserved.
            </Text>
            <Text className="text-xs text-text-tertiary leading-5">
              HealthSage complies with HIPAA regulations to ensure the privacy and security of your health information. All data is encrypted and stored securely.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

