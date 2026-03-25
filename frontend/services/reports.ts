/**
 * Reports API service — wired to backend /api/v1/mongo/reports
 */
import { apiClient } from './api';

export interface Report {
  id: string;
  patient_id: string;
  title: string;
  type: 'lab_report' | 'ai_summary' | 'visit_summary' | 'other';
  content: Record<string, unknown>;
  generated_at: string;
  generated_by?: string;
  attachment_url?: string;
  is_sent_to_patient?: boolean;
  sent_to_patient_at?: string | null;
  last_sent_at?: string | null;
  send_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ReportCreate {
  patient_id: string;
  title: string;
  type: 'lab_report' | 'ai_summary' | 'visit_summary' | 'other';
  content: Record<string, unknown>;
  attachment_url?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface BackendReportDoc {
  id?: string;
  _id?: string;
  patient_id: string;
  title: string;
  type: string;
  content?: Record<string, unknown>;
  generated_at?: string;
  generated_by?: string;
  attachment_url?: string;
  is_sent_to_patient?: boolean;
  sent_to_patient_at?: string | null;
  last_sent_at?: string | null;
  send_count?: number;
  created_at?: string;
  updated_at?: string;
}

function mapDoc(d: BackendReportDoc): Report {
  const id = (d.id ?? d._id ?? '').toString();
  const patientId = typeof d.patient_id === 'string' ? d.patient_id : (d.patient_id as { toString: () => string }).toString();
  return {
    id,
    patient_id: patientId,
    title: d.title,
    type: (d.type as Report['type']) ?? 'other',
    content: d.content ?? {},
    generated_at: d.generated_at ?? d.created_at ?? new Date().toISOString(),
    generated_by: d.generated_by,
    attachment_url: d.attachment_url,
    is_sent_to_patient: d.is_sent_to_patient ?? false,
    sent_to_patient_at: d.sent_to_patient_at ?? null,
    last_sent_at: d.last_sent_at ?? null,
    send_count: d.send_count ?? 0,
    created_at: d.created_at ?? new Date().toISOString(),
    updated_at: d.updated_at ?? new Date().toISOString(),
  };
}

const BASE = '/mongo/reports';

class ReportsService {
  async createReport(data: ReportCreate): Promise<Report> {
    const doc = await apiClient.post<BackendReportDoc>(BASE, data);
    return mapDoc(doc);
  }

  async getReports(params?: {
    patient_id?: string;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Report>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (params?.patient_id) queryParams.append('patient_id', params.patient_id);
    if (params?.type) queryParams.append('type', params.type);
    const query = queryParams.toString();
    const response = await apiClient.get<{ items: BackendReportDoc[]; total: number; page: number; limit: number; pages: number }>(
      `${BASE}?${query}`
    );
    return {
      items: (response.items ?? []).map(mapDoc),
      total: response.total ?? 0,
      page: response.page ?? 1,
      limit: response.limit ?? 20,
      pages: response.pages ?? 0,
    };
  }

  async getReport(reportId: string): Promise<Report> {
    const doc = await apiClient.get<BackendReportDoc>(`${BASE}/${reportId}`);
    return mapDoc(doc);
  }

  async updateReport(reportId: string, data: Partial<ReportCreate>): Promise<Report> {
    const doc = await apiClient.patch<BackendReportDoc>(`${BASE}/${reportId}`, data);
    return mapDoc(doc);
  }

  async sendReport(reportId: string): Promise<Report> {
    const doc = await apiClient.post<BackendReportDoc>(`${BASE}/${reportId}/send`);
    return mapDoc(doc);
  }

  async deleteReport(reportId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${reportId}`);
  }
}

export const reportsService = new ReportsService();
