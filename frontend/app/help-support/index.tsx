import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Button from '@/components/Button';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default function HelpSupportScreen() {
  const router = useRouter();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const faqs: FAQItem[] = [
    {
      id: '1',
      question: 'How do I book an appointment?',
      answer: 'To book an appointment, go to the Search tab, find a psychiatrist, and click on "Book Appointment". Select your preferred date and time, then fill in the reason for your visit.',
    },
    {
      id: '2',
      question: 'How can I view my reports?',
      answer: 'You can view your reports by going to the Saved tab and selecting "Reports". All your health assessment reports will be available there.',
    },
    {
      id: '3',
      question: 'Is my information secure?',
      answer: 'Yes, we take your privacy seriously. All your data is encrypted and stored securely. We comply with HIPAA regulations to ensure your health information is protected.',
    },
    {
      id: '4',
      question: 'Can I cancel or reschedule an appointment?',
      answer: 'Yes, you can cancel or reschedule your appointment by going to the Appointments section in the Saved tab. Click on your appointment and select the option to cancel or reschedule.',
    },
    {
      id: '5',
      question: 'How do I contact my psychiatrist?',
      answer: 'You can contact your psychiatrist through the chat feature. Go to the Chat Support option from the Home screen or use the chatbot for general inquiries.',
    },
    {
      id: '6',
      question: 'What should I do in case of an emergency?',
      answer: 'If you are experiencing a medical emergency, please call 911 immediately. HealthSage is not a substitute for emergency medical care.',
    },
  ];

  const supportOptions = [
    {
      id: '1',
      title: 'Chat with Support',
      description: 'Get instant help from our support team',
      icon: '💬',
      action: () => router.push('/chatbot' as any),
    },
    {
      id: '2',
      title: 'Email Support',
      description: 'support@healthsage.com',
      icon: '📧',
      action: () => {},
    },
    {
      id: '3',
      title: 'Phone Support',
      description: '1-800-HEALTH-SAGE',
      icon: '📞',
      action: () => {},
    },
  ];

  const handleSubmitContact = () => {
    if (!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message) {
      return;
    }
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      setContactForm({ name: '', email: '', subject: '', message: '' });
      alert('Thank you! We will get back to you soon.');
    }, 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Header title="Help & Support" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Support Options */}
          <View className="px-6 pt-4 pb-2">
            <Text className="text-lg font-semibold text-text mb-3">
              Contact Support
            </Text>
            <View className="flex-row flex-wrap justify-between">
              {supportOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={option.action}
                  className="w-[48%] mb-3"
                >
                  <Card className="items-center py-4">
                    <Text className="text-3xl mb-2">{option.icon}</Text>
                    <Text className="text-sm font-semibold text-text text-center mb-1">
                      {option.title}
                    </Text>
                    <Text className="text-xs text-text-secondary text-center">
                      {option.description}
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* FAQ Section */}
          <View className="px-6 pt-4 pb-2">
            <Text className="text-lg font-semibold text-text mb-3">
              Frequently Asked Questions
            </Text>
            {faqs.map((faq) => (
              <Card key={faq.id} className="mb-3">
                <TouchableOpacity
                  onPress={() =>
                    setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)
                  }
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-text flex-1 mr-2">
                      {faq.question}
                    </Text>
                    <Text className="text-text-tertiary text-xl">
                      {expandedFAQ === faq.id ? '−' : '+'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {expandedFAQ === faq.id && (
                  <View className="mt-3 pt-3 border-t border-border">
                    <Text className="text-sm text-text-secondary leading-5">
                      {faq.answer}
                    </Text>
                  </View>
                )}
              </Card>
            ))}
          </View>

          {/* Contact Form */}
          <View className="px-6 pt-4 pb-2">
            <Text className="text-lg font-semibold text-text mb-3">
              Send us a Message
            </Text>
            <Card>
              <View className="mb-4">
                <Text className="text-sm font-medium text-text mb-2">
                  Name <Text className="text-error">*</Text>
                </Text>
                <View className="flex-row items-center border-2 border-border rounded-lg px-4 py-3 bg-background">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter your name"
                    placeholderTextColor="#9CA3AF"
                    value={contactForm.name}
                    onChangeText={(text) => setContactForm({ ...contactForm, name: text })}
                    returnKeyType="next"
                    {...(Platform.OS === 'android' && { autoComplete: 'off' as any, importantForAutofill: 'no' as any })}
                    {...(Platform.OS === 'ios' && { textContentType: 'none' as any })}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-text mb-2">
                  Email <Text className="text-error">*</Text>
                </Text>
                <View className="flex-row items-center border-2 border-border rounded-lg px-4 py-3 bg-background">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    value={contactForm.email}
                    onChangeText={(text) => setContactForm({ ...contactForm, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    {...(Platform.OS === 'android' && { autoComplete: 'off' as any, importantForAutofill: 'no' as any })}
                    {...(Platform.OS === 'ios' && { textContentType: 'none' as any })}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-text mb-2">
                  Subject <Text className="text-error">*</Text>
                </Text>
                <View className="flex-row items-center border-2 border-border rounded-lg px-4 py-3 bg-background">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter subject"
                    placeholderTextColor="#9CA3AF"
                    value={contactForm.subject}
                    onChangeText={(text) => setContactForm({ ...contactForm, subject: text })}
                    returnKeyType="next"
                    {...(Platform.OS === 'android' && { autoComplete: 'off' as any, importantForAutofill: 'no' as any })}
                    {...(Platform.OS === 'ios' && { textContentType: 'none' as any })}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-text mb-2">
                  Message <Text className="text-error">*</Text>
                </Text>
                <View className="flex-row items-start border-2 border-border rounded-lg px-4 py-3 bg-background">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter your message"
                    placeholderTextColor="#9CA3AF"
                    value={contactForm.message}
                    onChangeText={(text) => setContactForm({ ...contactForm, message: text })}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    returnKeyType="done"
                    {...(Platform.OS === 'android' && { autoComplete: 'off' as any, importantForAutofill: 'no' as any })}
                    {...(Platform.OS === 'ios' && { textContentType: 'none' as any })}
                  />
                </View>
              </View>

              <Button
                onPress={handleSubmitContact}
                loading={submitting}
                disabled={!contactForm.name || !contactForm.email || !contactForm.subject || !contactForm.message}
                fullWidth
              >
                Send Message
              </Button>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

