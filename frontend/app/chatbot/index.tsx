import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppDialog from '@/components/AppDialog';
import Header from '@/components/Header';
import { colors } from '@/constants/colors';
import { authService, type UserRole } from '@/services/auth';
import { chatbotService, type ConversationSummary } from '@/services/chatbot';
import { doctorsService } from '@/services/doctors';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  whatIfComparison?: Record<string, any> | null;
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

function renderInlineMarkdown(
  text: string,
  baseTextStyle: object = styles.markdownParagraph,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern =
    /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Text key={`text-${match.index}`} style={baseTextStyle}>
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
      <Text key={`tail-${lastIndex}`} style={baseTextStyle}>
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
              <Text style={headingStyle}>{renderInlineMarkdown(block.content, headingStyle)}</Text>
            </View>
          );
        }

        if (block.type === 'bullet-list') {
          return (
            <View key={`bullets-${index}`} style={styles.markdownBlock}>
              {block.items.map((item, itemIndex) => (
                <View key={`bullet-${itemIndex}`} style={styles.listRow}>
                  <Text style={styles.listBullet}>-</Text>
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
              <Text style={styles.quoteText}>
                {renderInlineMarkdown(block.content, styles.quoteText)}
              </Text>
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
      ? `Ready for a new conversation for ${patientLabel}. Use New chat to start fresh, or open a previous session from the sidebar to continue earlier guidance.`
      : 'Hello. Select a patient to open a clinical conversation.',
    sender: 'bot',
    timestamp: new Date(),
  };
}

function mapTranscriptToMessages(
  transcript: { id?: string; role: string; content: string; created_at?: string }[],
): Message[] {
  return transcript.map((message, index) => ({
    id: message.id || `${message.role}-${index}`,
    text: message.content,
    sender: message.role === 'user' ? 'user' : 'bot',
    timestamp: message.created_at ? new Date(message.created_at) : new Date(),
    whatIfComparison: null,
  }));
}

function attachLatestAssistantComparison(
  transcriptMessages: Message[],
  comparison: Record<string, any> | null | undefined,
): Message[] {
  if (!comparison) {
    return transcriptMessages;
  }
  const next = [...transcriptMessages];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.sender === 'bot') {
      next[index] = {
        ...next[index],
        whatIfComparison: comparison,
      };
      break;
    }
  }
  return next;
}

function formatRiskPill(label?: string) {
  const normalized = String(label ?? '').toLowerCase();
  if (normalized === 'high') {
    return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
  }
  if (normalized === 'medium') {
    return { backgroundColor: '#FEF3C7', color: '#B45309' };
  }
  return { backgroundColor: '#DCFCE7', color: '#166534' };
}

function formatRiskPercent(score?: number) {
  return `${Math.round((score ?? 0) * 100)}%`;
}

function WhatIfDashboardCard({ comparison }: { comparison: Record<string, any> }) {
  const baseline = comparison?.baseline ?? {};
  const scenario = comparison?.scenario ?? {};
  const delta = comparison?.risk_delta ?? {};
  const changes = Array.isArray(comparison?.changes) ? comparison.changes : [];
  const baselinePill = formatRiskPill(baseline?.risk_label);
  const scenarioPill = formatRiskPill(scenario?.risk_label);

  return (
    <View style={styles.whatIfCard}>
      <Text style={styles.whatIfTitle}>
        {comparison?.scenario_name || 'What-If Analysis'}
      </Text>

      <View style={styles.whatIfSummaryRow}>
        <View style={styles.whatIfSummaryColumn}>
          <Text style={styles.whatIfLabel}>Baseline</Text>
          <Text style={styles.whatIfValue}>{formatRiskPercent(baseline?.risk_score)}</Text>
          <View style={[styles.whatIfPill, { backgroundColor: baselinePill.backgroundColor }]}>
            <Text style={[styles.whatIfPillText, { color: baselinePill.color }]}>
              {String(baseline?.risk_label || 'low').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.whatIfSummaryColumn}>
          <Text style={styles.whatIfLabel}>Scenario</Text>
          <Text style={styles.whatIfValue}>{formatRiskPercent(scenario?.risk_score)}</Text>
          <View style={[styles.whatIfPill, { backgroundColor: scenarioPill.backgroundColor }]}>
            <Text style={[styles.whatIfPillText, { color: scenarioPill.color }]}>
              {String(scenario?.risk_label || 'low').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.whatIfDeltaBox}>
        <Text style={styles.whatIfDeltaLabel}>Risk delta</Text>
        <Text style={styles.whatIfDeltaValue}>
          {Number(delta?.absolute ?? 0) > 0 ? '+' : ''}
          {Number(delta?.absolute ?? 0).toFixed(2)} ({delta?.relative_percent ?? 0}%)
        </Text>
        <Text style={styles.whatIfDeltaDirection}>
          {String(delta?.direction || 'no_change').replace(/_/g, ' ')}
        </Text>
      </View>

      {changes.length > 0 ? (
        <View style={styles.whatIfChangesBlock}>
          <Text style={styles.whatIfSectionTitle}>Changed features</Text>
          {changes.slice(0, 5).map((change: any, index: number) => (
            <Text key={`${change?.feature || index}`} style={styles.whatIfChangeLine}>
              - {change?.label || change?.feature}: {change?.baseline_value} {'->'} {change?.scenario_value}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function formatSessionTime(value?: string) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isValidConversationId(value?: string | null): value is string {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

export default function ChatbotScreen() {
  const params = useLocalSearchParams<{ patientId?: string; seedPrompt?: string; autoSend?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const requestedPatientId =
    typeof params.patientId === 'string' ? params.patientId : null;
  const requestedSeedPrompt =
    typeof params.seedPrompt === 'string' ? params.seedPrompt : '';
  const requestedAutoSend =
    params.autoSend === '1' || params.autoSend === 'true';
  const [role, setRole] = useState<UserRole | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientOptions, setPatientOptions] = useState<{ id: string; label: string }[]>([]);
  const [patientContext, setPatientContext] = useState<Record<string, unknown> | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationSessions, setConversationSessions] = useState<ConversationSummary[]>([]);
  const [startFreshConversation, setStartFreshConversation] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: '', message: '' });
  const flatListRef = useRef<FlatList<Message>>(null);
  const seededPromptSentRef = useRef(false);

  const selectedPatient = useMemo(
    () => patientOptions.find((option) => option.id === patientId) ?? null,
    [patientId, patientOptions],
  );

  const activeConversation = useMemo(
    () => conversationSessions.find((session) => session.conversation_id === conversationId) ?? null,
    [conversationId, conversationSessions],
  );

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        const currentRole = currentUser?.role ?? null;
        setRole(currentRole);

        if (currentRole !== 'doctor') {
          setMessages([
            {
              id: 'doctor-only',
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
        const initialPatient =
          options.find((option) => option.id === requestedPatientId) ?? options[0] ?? null;
        setPatientId(initialPatient?.id ?? null);
        setMessages(initialPatient ? [buildIntroMessage(initialPatient.label)] : [buildIntroMessage()]);
      } catch (error) {
        console.error('Failed to load patients for chatbot:', error);
        setMessages([
          {
            id: 'load-failed',
            text: 'The assistant could not load your patient list yet. Please refresh and try again.',
            sender: 'bot',
            timestamp: new Date(),
          },
        ]);
      }
    })();
  }, [requestedPatientId]);

  useEffect(() => {
    if (role !== 'doctor' || !patientId || !requestedSeedPrompt.trim()) {
      return;
    }
    setInputText((current) => current || requestedSeedPrompt.trim());
  }, [patientId, requestedSeedPrompt, role]);

  useEffect(() => {
    seededPromptSentRef.current = false;
  }, [requestedPatientId, requestedSeedPrompt]);

  useEffect(() => {
    if (!patientId) {
      setPatientContext(null);
      setConversationId(null);
      setConversationSessions([]);
      return;
    }

    (async () => {
      try {
        const [context, conversationList] = await Promise.all([
          chatbotService.getPatientContext(patientId),
          chatbotService.listPatientConversations(patientId),
        ]);

        setPatientContext(context);
        setConversationSessions(
          (conversationList.conversations ?? []).filter((session) =>
            isValidConversationId(session.conversation_id),
          ),
        );
        setConversationId(null);
        setStartFreshConversation(true);
        setMessages([buildIntroMessage(selectedPatient?.label)]);
      } catch (error) {
        console.error('Failed to load patient context:', error);
        setPatientContext(null);
        setConversationId(null);
        setConversationSessions([]);
        setMessages([
          {
            id: 'thread-load-failed',
            text: 'The assistant could not load saved sessions for this patient yet. You can still start a new chat below.',
            sender: 'bot',
            timestamp: new Date(),
          },
        ]);
      }
    })();
  }, [patientId, selectedPatient?.label]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timeout);
  }, [messages]);

  const refreshConversationSessions = async (nextPatientId: string) => {
    const sessions = await chatbotService.listPatientConversations(nextPatientId);
    setConversationSessions(
      (sessions.conversations ?? []).filter((session) => isValidConversationId(session.conversation_id)),
    );
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
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

    const pendingUserMessage: Message = {
      id: `u-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, pendingUserMessage]);
    if (!overrideText) {
      setInputText('');
    } else {
      setInputText('');
    }
    setSending(true);

    try {
      const subject =
        conversationId === null
          ? text.split(/\s+/).slice(0, 8).join(' ').trim() || 'Clinical chat'
          : undefined;
      const response = await chatbotService.chat({
        patient_id: patientId,
        doctor_query: text,
        mode: 'master',
        conversation_id: startFreshConversation ? undefined : conversationId ?? undefined,
        subject,
        start_new: startFreshConversation,
      });

      if (response.conversation_id) {
        setConversationId(response.conversation_id);
        setStartFreshConversation(false);
      }

      if ((response.transcript ?? []).length > 0) {
        setMessages(
          attachLatestAssistantComparison(
            mapTranscriptToMessages(response.transcript ?? []),
            (response.response?.agent_outputs as any)?.whatif?.comparison,
          ),
        );
      } else {
        const botText = response.response?.final_message ?? 'No response from assistant.';
        setMessages((prev) => [
          ...prev,
          {
            id: `b-${Date.now()}`,
            text: botText,
            sender: 'bot',
            timestamp: new Date(),
            whatIfComparison: (response.response?.agent_outputs as any)?.whatif?.comparison ?? null,
          },
        ]);
      }

      await refreshConversationSessions(patientId);

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

  useEffect(() => {
    if (
      !requestedAutoSend ||
      seededPromptSentRef.current ||
      role !== 'doctor' ||
      !patientId ||
      !requestedSeedPrompt.trim() ||
      sending
    ) {
      return;
    }

    seededPromptSentRef.current = true;
    handleSend(requestedSeedPrompt.trim()).catch(() => {
      seededPromptSentRef.current = false;
    });
  }, [patientId, requestedAutoSend, requestedSeedPrompt, role, sending]);

  const handleNewChat = () => {
    setConversationId(null);
    setStartFreshConversation(true);
    setMessages([buildIntroMessage(selectedPatient?.label)]);
    setInputText('');
    setSidebarVisible(false);
  };

  const handleOpenConversation = async (session: ConversationSummary) => {
    if (!isValidConversationId(session.conversation_id)) {
      setDialog({
        visible: true,
        title: 'Conversation unavailable',
        message: 'This saved chat session has an invalid id. Refresh the page and try again.',
      });
      return;
    }

    try {
      const transcript = await chatbotService.getConversationTranscript(
        session.conversation_id,
        session.patient_id || patientId || undefined,
      );
      setConversationId(session.conversation_id);
      setStartFreshConversation(false);
      setMessages(mapTranscriptToMessages(transcript.transcript ?? []));
      setSidebarVisible(false);
    } catch (error: any) {
      console.error('Failed to open conversation:', error);
      setDialog({
        visible: true,
        title: 'Conversation unavailable',
        message: error?.message || 'This chat session could not be loaded right now.',
      });
    }
  };

  const handleContinueLatestConversation = async () => {
    if (conversationSessions.length === 0) {
      return;
    }
    await handleOpenConversation(conversationSessions[0]);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowBot,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.botBubble,
            !isUser && isDesktop ? styles.botBubbleDesktop : null,
          ]}
        >
          {isUser ? (
            <Text style={styles.userMessageText}>{item.text}</Text>
          ) : (
            <View>
              <BotMarkdown text={item.text} />
              {item.whatIfComparison ? (
                <WhatIfDashboardCard comparison={item.whatIfComparison} />
              ) : null}
            </View>
          )}
        </View>
        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampBot]}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const sidebarContent = (
    <View style={styles.sidebarPanel}>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarEyebrow}>HealthSage Assistant</Text>
        <Text style={styles.sidebarTitle}>Chats</Text>
      </View>

      <TouchableOpacity style={styles.newChatButton} activeOpacity={0.85} onPress={handleNewChat}>
        <Text style={styles.newChatButtonText}>+ New chat</Text>
      </TouchableOpacity>

      {conversationSessions.length > 0 ? (
        <TouchableOpacity
          style={styles.continueLatestButton}
          activeOpacity={0.85}
          onPress={handleContinueLatestConversation}
        >
          <Text style={styles.continueLatestLabel}>Continue latest</Text>
          <Text style={styles.continueLatestTitle} numberOfLines={1}>
            {conversationSessions[0]?.subject || 'Clinical chat'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.sidebarSectionLabel}>Patients</Text>
      <ScrollView
        style={styles.patientList}
        contentContainerStyle={styles.patientListContent}
        showsVerticalScrollIndicator={false}
      >
        {patientOptions.map((patient) => {
          const isActive = patient.id === patientId;
          return (
            <TouchableOpacity
              key={patient.id}
              style={[styles.patientChip, isActive ? styles.patientChipActive : null]}
              activeOpacity={0.85}
              onPress={() => {
                setPatientId(patient.id);
                setSidebarVisible(false);
              }}
            >
              <Text style={[styles.patientChipText, isActive ? styles.patientChipTextActive : null]}>
                {patient.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.sessionHeaderRow}>
        <Text style={styles.sidebarSectionLabel}>Recent sessions</Text>
        <Text style={styles.sessionCountText}>{conversationSessions.length}</Text>
      </View>

      <ScrollView style={styles.sessionList} showsVerticalScrollIndicator={false}>
        {conversationSessions.length === 0 ? (
          <View style={styles.emptySessionCard}>
            <Text style={styles.emptySessionText}>
              No saved sessions yet for this patient.
            </Text>
          </View>
        ) : (
          conversationSessions.map((session) => {
            const isActive = session.conversation_id === conversationId;
            return (
              <TouchableOpacity
                key={session.conversation_id}
                style={[styles.sessionCard, isActive ? styles.sessionCardActive : null]}
                activeOpacity={0.85}
                onPress={() => handleOpenConversation(session)}
              >
                <Text style={[styles.sessionTitle, isActive ? styles.sessionTitleActive : null]} numberOfLines={1}>
                  {session.subject || 'Clinical chat'}
                </Text>
                <Text style={styles.sessionPreview} numberOfLines={2}>
                  {session.preview || 'Open this session to continue the thread.'}
                </Text>
                <Text style={styles.sessionMeta}>
                  {formatSessionTime(session.updated_at || session.created_at)}
                </Text>
                <Text style={styles.sessionOpenHint}>Open chat</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog({ visible: false, title: '', message: '' })}
      />

      <Header title="HealthSage Assistant" showBack />

      <View style={styles.shell}>
        {isDesktop ? <View style={styles.sidebarDesktop}>{sidebarContent}</View> : null}

        <View style={styles.mainPanel}>
          <View style={styles.mainHeader}>
            <View style={styles.mainHeaderLeft}>
              {!isDesktop ? (
                <TouchableOpacity
                  style={styles.mobileSidebarButton}
                  activeOpacity={0.85}
                  onPress={() => setSidebarVisible(true)}
                >
                  <Text style={styles.mobileSidebarButtonText}>Chats</Text>
                </TouchableOpacity>
              ) : null}

              <View>
                <Text style={styles.threadTitle}>
                  {activeConversation?.subject || 'New clinical chat'}
                </Text>
                <Text style={styles.threadSubtitle}>
                  {selectedPatient?.label || 'Select a patient'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.compactNewChatButton}
              activeOpacity={0.85}
              onPress={handleNewChat}
            >
              <Text style={styles.compactNewChatText}>New chat</Text>
            </TouchableOpacity>
          </View>

          {patientContext ? (
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Active patient context</Text>
              <Text style={styles.contextText}>
                {(patientContext.risk_summary as string) ||
                  (patientContext.latest_risk_summary as string) ||
                  'The assistant will use the latest saved patient profile and recommendations.'}
              </Text>
            </View>
          ) : null}

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.chatColumn}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              style={styles.messageList}
              contentContainerStyle={[
                styles.messageListContent,
                { paddingHorizontal: isDesktop ? 32 : 16 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            />

            <View
              style={[
                styles.composerShell,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <View style={styles.composerCard}>
                <TextInput
                  style={styles.input}
                  placeholder="Message HealthSage..."
                  placeholderTextColor="#94A3B8"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={700}
                  editable={!sending}
                />
                <TouchableOpacity
                  onPress={() => {
                    handleSend().catch(() => undefined);
                  }}
                  disabled={!inputText.trim() || sending}
                  activeOpacity={0.85}
                  style={[
                    styles.sendButton,
                    inputText.trim() && !sending ? styles.sendButtonActive : styles.sendButtonDisabled,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendButtonText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>

      {!isDesktop ? (
        <Modal
          visible={sidebarVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setSidebarVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={styles.modalDismissArea}
              activeOpacity={1}
              onPress={() => setSidebarVisible(false)}
            />
            <View style={styles.sidebarMobile}>{sidebarContent}</View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
  },
  sidebarDesktop: {
    width: 320,
    borderRightWidth: 1,
    borderRightColor: colors.border.light,
    backgroundColor: colors.background.card,
  },
  sidebarMobile: {
    width: '86%',
    maxWidth: 340,
    height: '100%',
    backgroundColor: colors.background.card,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  modalBackdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.overlay.medium,
  },
  modalDismissArea: {
    flex: 1,
  },
  sidebarPanel: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
  },
  sidebarHeader: {
    marginBottom: 18,
  },
  sidebarEyebrow: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sidebarTitle: {
    color: colors.text.primary,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  newChatButton: {
    borderRadius: 18,
    backgroundColor: colors.primary.main,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  newChatButtonText: {
    color: colors.primary.contrast,
    fontSize: 15,
    fontWeight: '700',
  },
  continueLatestButton: {
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  continueLatestLabel: {
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  continueLatestTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  sidebarSectionLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  patientList: {
    maxHeight: 168,
    marginBottom: 16,
  },
  patientListContent: {
    gap: 8,
  },
  patientChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  patientChipActive: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light,
  },
  patientChipText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  patientChipTextActive: {
    color: colors.text.primary,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sessionCountText: {
    color: colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionList: {
    flex: 1,
  },
  emptySessionCard: {
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptySessionText: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sessionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  sessionCardActive: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.light,
  },
  sessionTitle: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionTitleActive: {
    color: colors.text.primary,
  },
  sessionPreview: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  sessionMeta: {
    color: colors.text.tertiary,
    fontSize: 11,
    marginTop: 10,
  },
  sessionOpenHint: {
    color: colors.primary.dark,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  mainPanel: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.background.card,
  },
  mainHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  mobileSidebarButton: {
    borderRadius: 14,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 12,
  },
  mobileSidebarButtonText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  threadTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  threadSubtitle: {
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  compactNewChatButton: {
    borderRadius: 14,
    backgroundColor: colors.primary.main,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 12,
  },
  compactNewChatText: {
    color: colors.primary.contrast,
    fontSize: 13,
    fontWeight: '700',
  },
  contextCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  contextLabel: {
    color: colors.primary.dark,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  contextText: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 21,
  },
  chatColumn: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingTop: 18,
    paddingBottom: 24,
  },
  messageRow: {
    marginBottom: 18,
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageRowBot: {
    alignItems: 'stretch',
  },
  messageBubble: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  userBubble: {
    maxWidth: 720,
    backgroundColor: colors.primary.main,
  },
  botBubble: {
    width: '100%',
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  botBubbleDesktop: {
    maxWidth: 860,
    alignSelf: 'center',
  },
  userMessageText: {
    color: colors.primary.contrast,
    fontSize: 15,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
  },
  timestampUser: {
    marginRight: 8,
  },
  timestampBot: {
    marginLeft: 8,
  },
  composerShell: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.card,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.card,
    paddingLeft: 16,
    paddingRight: 10,
    paddingTop: 12,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    minHeight: 28,
    maxHeight: 140,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    paddingRight: 12,
  },
  sendButton: {
    borderRadius: 18,
    minWidth: 78,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary.main,
  },
  sendButtonDisabled: {
    backgroundColor: colors.text.disabled,
  },
  sendButtonText: {
    color: colors.primary.contrast,
    fontSize: 14,
    fontWeight: '700',
  },
  whatIfCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 14,
  },
  whatIfTitle: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  whatIfSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  whatIfSummaryColumn: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  whatIfLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  whatIfValue: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  whatIfPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  whatIfPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  whatIfDeltaBox: {
    borderRadius: 14,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 12,
    marginBottom: 12,
  },
  whatIfDeltaLabel: {
    color: colors.text.tertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  whatIfDeltaValue: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  whatIfDeltaDirection: {
    color: colors.text.secondary,
    fontSize: 13,
  },
  whatIfChangesBlock: {
    marginTop: 2,
  },
  whatIfSectionTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  whatIfChangeLine: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  markdownBlock: {
    marginBottom: 10,
  },
  markdownParagraph: {
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 22,
  },
  markdownHeadingLarge: {
    color: colors.text.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  markdownHeadingMedium: {
    color: colors.text.primary,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  markdownHeadingSmall: {
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  markdownStrong: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  markdownEmphasis: {
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  markdownLink: {
    color: colors.primary.dark,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  inlineCode: {
    backgroundColor: colors.background.secondary,
    color: colors.text.primary,
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quoteBlock: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
    backgroundColor: colors.primary.light,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  quoteText: {
    color: colors.text.primary,
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
    color: colors.primary.dark,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  listNumber: {
    width: 24,
    color: colors.primary.dark,
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
    backgroundColor: colors.background.secondary,
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  codeBlock: {
    minWidth: '100%',
    backgroundColor: colors.background.dark,
    color: colors.text.inverse,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    overflow: 'hidden',
  },
});
