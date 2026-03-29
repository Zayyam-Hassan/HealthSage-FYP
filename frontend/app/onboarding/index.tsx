import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { images } from '@/constants/images';

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      illustration: images.helpingImage1,
      title: "Your Health, Your Journey",
      description: "Easily Connect With Your Doctors, Manage Appointments, And View Your Complete Health Record All In One Trusted Platform Built For Your Well-Being."
    },
    {
      illustration: images.helpingImage2,
      title: "Smart Care Starts Here",
      description: "Access comprehensive healthcare services, track your health metrics, and get personalized recommendations from trusted medical professionals."
    },
    {
      illustration: images.helpingImage3,
      title: "Your Trusted Companion",
      description: "Experience seamless healthcare management with advanced features designed to keep you and your loved ones healthy and informed."
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  useEffect(() => {
    // Auto-navigate after 5 seconds if user doesn't interact
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center px-6 py-12">
          {/* Illustration */}
          <View className="w-80 h-80 bg-white rounded-full items-center justify-center mb-8 shadow-2xl overflow-hidden" style={{ width: 320, height: 320 }}>
            <Image
              source={steps[currentStep].illustration}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>

          {/* Branding */}
          <Text className="text-4xl font-bold text-white mb-2 text-center">
            HEALTHSAGE
          </Text>
          <Text className="text-base text-white/90 text-center mb-12">
            Smart care starts with HealthSage
          </Text>

          {/* Content */}
          <View className="w-full mb-12">
            <Text className="text-3xl font-bold text-white mb-4 text-left">
              {steps[currentStep].title}
            </Text>
            <Text className="text-base text-white/90 leading-6 text-left">
              {steps[currentStep].description}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Navigation */}
      <View className="px-6 pb-8 flex-row justify-between items-center">
        <View className="flex-row gap-2">
          {steps.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full ${
                index === currentStep ? 'bg-white w-8' : 'bg-white/30 w-2'
              }`}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={handleNext}
          className="w-14 h-14 bg-white rounded-full items-center justify-center shadow-lg"
          activeOpacity={0.7}
        >
          <Text className="text-primary text-2xl font-bold">{'>'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
