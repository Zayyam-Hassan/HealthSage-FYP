/**
 * Chatbot API service — wired to backend POST /chatbot/chat (persists conversation + messages).
 */
import { apiClient } from './api';

export interface ChatWithHistoryRequest {
  patient_id: string;
  doctor_query: string;
  mode?: string;
  conversation_id?: string | null;
  subject?: string;
}

export interface ChatWithHistoryResponse {
  response: {
    final_message: string;
    agent_outputs?: Record<string, unknown>;
    mode?: string;
    patient_id?: string;
    report_created?: boolean;
    failed?: boolean;
  };
  conversation_id: string;
  message_id_user?: string;
  message_id_assistant?: string;
  transcript?: Array<{ id?: string; role: string; content: string; created_at?: string }>;
}

export interface ConversationTranscriptResponse {
  conversation_id: string | null;
  patient_id: string;
  transcript: Array<{ id?: string; role: string; content: string; created_at?: string }>;
}

class ChatbotService {
  /**
   * Send a message and get assistant reply. Pass conversation_id to continue a thread.
   */
  async chat(payload: ChatWithHistoryRequest): Promise<ChatWithHistoryResponse> {
    const body: Record<string, unknown> = {
      patient_id: payload.patient_id,
      doctor_query: payload.doctor_query,
      mode: payload.mode ?? 'master',
      subject: payload.subject ?? 'Clinical chat',
    };
    if (payload.conversation_id) {
      body.conversation_id = payload.conversation_id;
    }
    return await apiClient.post<ChatWithHistoryResponse>('/chatbot/chat', body);
  }

  /**
   * Get patient context (risk, summary, recommendations) when opening chat for a patient.
   */
  async getPatientContext(patientId: string): Promise<Record<string, unknown>> {
    return await apiClient.get<Record<string, unknown>>(`/chatbot/patient-context/${patientId}`);
  }

  async getLatestConversation(patientId: string): Promise<ConversationTranscriptResponse> {
    return await apiClient.get<ConversationTranscriptResponse>(
      `/chatbot/patients/${patientId}/conversation`,
    );
  }

  async getConversationTranscript(conversationId: string): Promise<ConversationTranscriptResponse> {
    return await apiClient.get<ConversationTranscriptResponse>(
      `/chatbot/conversations/${conversationId}/transcript`,
    );
  }
}

export const chatbotService = new ChatbotService();
