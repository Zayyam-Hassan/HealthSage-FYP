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
  ScrollView,
  StyleSheet,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
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

type MarkdownBlock =
  | { type: 'heading'; level: number; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'quote'; content: string }
  | { type: 'code'; content: string; language?: string };

function isMarkdownBoundary(line: string): boolean {
  return (
    /^#{1,6}\s+/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^```/.test(line)
  );
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return [{ type: 'paragraph', content: '' }];
  }

  const lines = normalized.split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeFence = trimmed.match(/^```([a-zA-Z0-9_-]+)?\s*$/);
    if (codeFence) {
      const language = codeFence[1];
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].trim().startsWith('```')) {
        index += 1;
      }
      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        language,
      });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        content: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'quote', content: quoteLines.join('\n') });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'bullet-list', items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      if (!current.trim()) {
        index += 1;
        break;
      }
      if (paragraphLines.length > 0 && isMarkdownBoundary(current)) {
        break;
      }
      paragraphLines.push(current.trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: paragraphLines.join('\n') });
  }

  return blocks;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern =
    /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Text key={`text-${match.index}`} style={styles.markdownParagraph}>
          {text.slice(lastIndex, match.index)}
        </Text>,
      );
    }

    if (match[2] && match[3]) {
      const label = match[2];
      const url = match[3];
      nodes.push(
        <Text
          key={`link-${match.index}`}
          style={styles.markdownLink}
          onPress={() => {
            ExpoLinking.openURL(url).catch(() => undefined);
          }}
        >
          {label}
        </Text>,
      );
    } else if (match[4]) {
      nodes.push(
        <Text key={`code-${match.index}`} style={styles.inlineCode}>
          {match[4]}
        </Text>,
      );
    } else if (match[5] || match[6]) {
      nodes.push(
        <Text key={`bold-${match.index}`} style={styles.markdownStrong}>
          {match[5] || match[6]}
        </Text>,
      );
    } else if (match[7] || match[8]) {
      nodes.push(
        <Text key={`italic-${match.index}`} style={styles.markdownEmphasis}>
          {match[7] || match[8]}
        </Text>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Text key={`tail-${lastIndex}`} style={styles.markdownParagraph}>
        {text.slice(lastIndex)}
      </Text>,
    );
  }

  return nodes;
}

function BotMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const headingStyle =
            block.level <= 2
              ? styles.markdownHeadingLarge
              : block.level <= 4
                ? styles.markdownHeadingMedium
                : styles.markdownHeadingSmall;
          return (
            <View key={`heading-${index}`} style={styles.markdownBlock}>
              <Text style={headingStyle}>{block.content}</Text>
            </View>
          );
        }

        if (block.type === 'bullet-list') {
          return (
            <View key={`bullets-${index}`} style={styles.markdownBlock}>
              {block.items.map((item, itemIndex) => (
                <View key={`bullet-${itemIndex}`} style={styles.listRow}>
                  <Text style={styles.listBullet}>•</Text>
                  <Text style={styles.markdownParagraph}>{renderInlineMarkdown(item)}</Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <View key={`ordered-${index}`} style={styles.markdownBlock}>
              {block.items.map((item, itemIndex) => (
                <View key={`ordered-item-${itemIndex}`} style={styles.listRow}>
                  <Text style={styles.listNumber}>{itemIndex + 1}.</Text>
                  <Text style={styles.markdownParagraph}>{renderInlineMarkdown(item)}</Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.type === 'quote') {
          return (
            <View key={`quote-${index}`} style={[styles.markdownBlock, styles.quoteBlock]}>
              <Text style={styles.quoteText}>{renderInlineMarkdown(block.content)}</Text>
            </View>
          );
        }

        if (block.type === 'code') {
          return (
            <View key={`code-${index}`} style={styles.markdownBlock}>
              {block.language ? (
                <Text style={styles.codeLanguage}>{block.language.toUpperCase()}</Text>
              ) : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.codeBlock}>{block.content}</Text>
              </ScrollView>
            </View>
          );
        }

        return (
          <View key={`paragraph-${index}`} style={styles.markdownBlock}>
            <Text style={styles.markdownParagraph}>{renderInlineMarkdown(block.content)}</Text>
          </View>
        );
      })}
    </View>
  );
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
            {isUser ? (
              <Text className="text-sm leading-5 text-white">{item.text}</Text>
            ) : (
              <BotMarkdown text={item.text} />
            )}
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

const styles = StyleSheet.create({
  markdownBlock: {
    marginBottom: 10,
  },
  markdownParagraph: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 22,
  },
  markdownHeadingLarge: {
    color: '#0F172A',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  markdownHeadingMedium: {
    color: '#0F172A',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  markdownHeadingSmall: {
    color: '#1F2937',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  markdownStrong: {
    color: '#0F172A',
    fontWeight: '700',
  },
  markdownEmphasis: {
    color: '#334155',
    fontStyle: 'italic',
  },
  markdownLink: {
    color: '#0F766E',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  inlineCode: {
    backgroundColor: '#EEF2FF',
    color: '#312E81',
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quoteBlock: {
    borderLeftWidth: 4,
    borderLeftColor: '#14B8A6',
    backgroundColor: '#F0FDFA',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  quoteText: {
    color: '#134E4A',
    fontSize: 14,
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listBullet: {
    width: 18,
    color: '#0F766E',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  listNumber: {
    width: 24,
    color: '#0F766E',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
  },
  codeLanguage: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  codeBlock: {
    minWidth: '100%',
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    overflow: 'hidden',
  },
});
