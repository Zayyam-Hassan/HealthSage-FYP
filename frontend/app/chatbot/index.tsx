import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppDialog from '@/components/AppDialog';
import Header from '@/components/Header';
import Card from '@/components/Card';
import { authService, type UserRole } from '@/services/auth';
import { chatbotService } from '@/services/chatbot';
import { doctorsService } from '@/services/doctors';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

function buildIntroMessage(patientLabel?: string): Message {
  return {
    id: 'intro',
    text: patientLabel
      ? `Welcome back. I have loaded the latest assistant thread for ${patientLabel}. Ask about risk, lifestyle, medication, or generate a patient report when you are ready.`
      : "Hello! I'm your HealthSage assistant. Select one of your patients and ask a focused clinical question.",
    sender: 'bot',
    timestamp: new Date(),
  };
}

export default function ChatbotScreen() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<UserRole | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientOptions, setPatientOptions] = useState<{ id: string; label: string }[]>([]);
  const [patientContext, setPatientContext] = useState<Record<string, unknown> | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: '', message: '' });
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        const currentRole = currentUser?.role ?? null;
        setRole(currentRole);

        if (currentRole !== 'doctor') {
          setMessages([
            {
              id: '1',
              text: 'The clinical assistant is available only to doctors.',
              sender: 'bot',
              timestamp: new Date(),
            },
          ]);
          return;
        }

        const res = await doctorsService.getMyPatients();
        const options = res.items.map((p) => ({
          id: p.id,
          label: p.full_name || p.patient_id || p.id,
        }));
        setPatientOptions(options);
        setPatientId(options[0]?.id ?? null);
        setMessages(options[0] ? [buildIntroMessage(options[0].label)] : [buildIntroMessage()]);
      } catch (e) {
        console.error('Failed to load patients for chatbot:', e);
        setMessages([
          {
            id: '1',
            text: 'The assistant could not load the patient context yet. Please refresh and try again.',
            sender: 'bot',
            timestamp: new Date(),
          },
        ]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!patientId) {
      setPatientContext(null);
      setConversationId(null);
      return;
    }

    const selectedPatient = patientOptions.find((option) => option.id === patientId);

    (async () => {
      try {
        const [context, latestConversation] = await Promise.all([
          chatbotService.getPatientContext(patientId),
          chatbotService.getLatestConversation(patientId),
        ]);

        setPatientContext(context);
        setConversationId(latestConversation.conversation_id ?? null);

        if ((latestConversation.transcript ?? []).length > 0) {
          setMessages(
            latestConversation.transcript.map((message, index) => ({
              id: message.id || `${message.role}-${index}`,
              text: message.content,
              sender: message.role === 'user' ? 'user' : 'bot',
              timestamp: message.created_at ? new Date(message.created_at) : new Date(),
            })),
          );
          return;
        }

        setMessages([buildIntroMessage(selectedPatient?.label)]);
      } catch (error) {
        console.error('Failed to load patient context:', error);
        setPatientContext(null);
        setConversationId(null);
        setMessages([
          {
            id: 'load-error',
            text: 'The assistant could not load the latest thread for this patient yet. You can still start a new question below.',
            sender: 'bot',
            timestamp: new Date(),
          },
        ]);
      }
    })();
  }, [patientId, patientOptions]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    if (role !== 'doctor') {
      setDialog({
        visible: true,
        title: 'Access restricted',
        message: 'Only doctors can use the assistant.',
      });
      return;
    }
    if (!patientId) {
      setDialog({
        visible: true,
        title: 'Select patient',
        message: 'Please select a patient first.',
      });
      return;
    }

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setSending(true);

    try {
      const response = await chatbotService.chat({
        patient_id: patientId,
        doctor_query: text,
        mode: 'master',
        conversation_id: conversationId ?? undefined,
      });
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      const botText = response.response?.final_message ?? 'No response from assistant.';
      const botMessage: Message = {
        id: `b-${Date.now()}`,
        text: botText,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      if (response.response?.report_created) {
        setDialog({
          visible: true,
          title: 'Report draft created',
          message: 'A patient-ready report draft has been added to Reports for doctor review.',
        });
      }
    } catch (err: any) {
      const errorMsg = err?.message || err?.detail || 'Failed to get response.';
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          text: `Error: ${errorMsg}`,
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View className={`mb-4 px-4 ${isUser ? 'items-end' : 'items-center'}`}>
        <View className={`flex-row items-start ${isUser ? 'max-w-[82%]' : 'w-full'}`}>
          {!isUser && (
            <View className="w-10 h-10 bg-primary rounded-full items-center justify-center mr-3 mt-1 shadow-md">
              <Text className="text-white text-xs font-bold">HS</Text>
            </View>
          )}
          <Card
            className={`${
              isUser
                ? 'bg-primary rounded-[24px] rounded-tr-sm shadow-md'
                : 'flex-1 bg-white rounded-[24px] border border-border/50'
            }`}
            padding={isUser ? 'sm' : 'md'}
          >
            <Text className={`text-sm leading-5 ${isUser ? 'text-white' : 'text-text'}`}>
              {item.text}
            </Text>
          </Card>
          {isUser && (
            <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center ml-3 mt-1 border-2 border-primary/30">
              <Text className="text-primary text-xs font-bold">You</Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-text-tertiary mt-1 px-2">
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog({ visible: false, title: '', message: '' })}
      />
      <Header title="HealthSage Assistant" showBack />
      {patientOptions.length > 0 && (
        <View className="px-4 py-2 border-b border-border">
          <Text className="text-xs text-text-secondary mb-1">
            {role === 'doctor' ? 'Patient' : 'Your record'}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {patientOptions.slice(0, 5).map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPatientId(p.id)}
                className={`px-3 py-1.5 rounded-full ${
                  patientId === p.id ? 'bg-primary' : 'bg-bg-secondary border border-border'
                }`}
              >
                <Text className={`text-sm ${patientId === p.id ? 'text-white' : 'text-text'}`}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {patientContext ? (
        <View className="px-4 pt-3">
          <Card className="border border-primary/20 bg-primary/5">
            <Text className="text-sm font-semibold text-text mb-1">
              Selected patient context
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {(patientContext.risk_summary as string) ||
                (patientContext.latest_risk_summary as string) ||
                'The assistant will use the latest saved health profile and prediction data.'}
            </Text>
          </Card>
        </View>
      ) : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{
            paddingVertical: 16,
            paddingBottom: 120,
            paddingTop: 8,
          }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View
          className="absolute left-0 right-0 bg-background border-t border-border px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row items-end">
            <View className="flex-1 bg-white rounded-[24px] px-4 py-3 mr-3 border border-border shadow-sm">
              <TextInput
                className="text-base text-text"
                placeholder="Ask about risk, lifestyle, medication, or say 'generate a patient report'"
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                style={{ maxHeight: 100 }}
                editable={!sending}
              />
            </View>
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              className={`px-5 h-12 rounded-[20px] items-center justify-center shadow-md ${
                inputText.trim() && !sending ? 'bg-primary' : 'bg-text-disabled'
              }`}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white text-sm font-bold">Send</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
