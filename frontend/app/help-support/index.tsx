import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { colors } from '@/constants/colors';

type IonIcon = React.ComponentProps<typeof Ionicons>['name'];

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

  const supportOptions: {
    id: string;
    title: string;
    description: string;
    icon: IonIcon;
    action: () => void;
  }[] = [
    {
      id: '1',
      title: 'Chat with support',
      description: 'Get instant help from our support team',
      icon: 'chatbubbles-outline',
      action: () => router.push('/chatbot' as any),
    },
    {
      id: '2',
      title: 'Email support',
      description: 'support@healthsage.com',
      icon: 'mail-outline',
      action: () => {},
    },
    {
      id: '3',
      title: 'Phone support',
      description: '1-800-HEALTH-SAGE',
      icon: 'call-outline',
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
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
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
          <View className="px-6 pt-6 pb-2">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
              Get help
            </Text>
            <Text className="text-xl font-bold text-text mb-4 tracking-tight">Contact support</Text>
            <View className="flex-row flex-wrap justify-between">
              {supportOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={option.action}
                  className="w-[48%] mb-3"
                  activeOpacity={0.85}
                >
                  <Card className="items-center py-4 border-border/80">
                    <View className="w-11 h-11 rounded-[14px] bg-primary/10 items-center justify-center mb-3 border border-primary/10">
                      <Ionicons name={option.icon} size={22} color={colors.primary.main} />
                    </View>
                    <Text className="text-sm font-semibold text-text text-center mb-1">
                      {option.title}
                    </Text>
                    <Text className="text-xs text-text-secondary text-center leading-4">
                      {option.description}
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* FAQ Section */}
          <View className="px-6 pt-4 pb-2">
            <Text className="text-xl font-bold text-text mb-4 tracking-tight">
              Frequently asked questions
            </Text>
            {faqs.map((faq) => (
              <Card key={faq.id} className="mb-3 border-border/80">
                <TouchableOpacity
                  onPress={() =>
                    setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)
                  }
                  activeOpacity={0.8}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-text flex-1 mr-2 leading-6">
                      {faq.question}
                    </Text>
                    <Ionicons
                      name={expandedFAQ === faq.id ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color={colors.text.tertiary}
                    />
                  </View>
                </TouchableOpacity>
                {expandedFAQ === faq.id ? (
                  <View className="mt-3 pt-3 border-t border-border/80">
                    <Text className="text-sm text-text-secondary leading-6">
                      {faq.answer}
                    </Text>
                  </View>
                ) : null}
              </Card>
            ))}
          </View>

          {/* Contact Form */}
          <View className="px-6 pt-4 pb-8">
            <Text className="text-xl font-bold text-text mb-4 tracking-tight">Send us a message</Text>
            <Card className="border-border/80">
              <View className="mb-4">
                <Text className="text-sm font-medium text-text mb-2">
                  Name <Text className="text-error">*</Text>
                </Text>
                <View className="flex-row items-center border border-border/90 rounded-2xl px-4 py-3.5 bg-background">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter your name"
                    placeholderTextColor={colors.text.tertiary}
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
                <View className="flex-row items-center border border-border/90 rounded-2xl px-4 py-3.5 bg-background">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter your email"
                    placeholderTextColor={colors.text.tertiary}
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
                <View className="flex-row items-center border border-border/90 rounded-2xl px-4 py-3.5 bg-background">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter subject"
                    placeholderTextColor={colors.text.tertiary}
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
                <View className="flex-row items-start border border-border/90 rounded-2xl px-4 py-3.5 bg-background min-h-[120px]">
                  <TextInput
                    className="flex-1 text-base text-text"
                    placeholder="Enter your message"
                    placeholderTextColor={colors.text.tertiary}
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

