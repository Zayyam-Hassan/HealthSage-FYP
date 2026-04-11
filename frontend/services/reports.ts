import { apiClient, LONG_RUNNING_REQUEST_TIMEOUT_MS } from './api';

export type UploadedReportCategory = 'patient_sent' | 'doctor_sent' | 'system_generated';

export interface UploadedReport {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  title: string;
  category: UploadedReportCategory;
  description: string | null;
  uploaded_by_role: 'patient' | 'doctor';
  uploaded_by_user_id: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  file_url: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedReport {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  report_type: string;
  title: string;
  summary: string | null;
  structured_payload: Record<string, unknown>;
  generated_by: string | null;
  source_reference: string | null;
  attachment_url: string | null;
  is_sent_to_patient: boolean;
  sent_to_patient_at: string | null;
  last_sent_at: string | null;
  send_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReportOverviewResponse {
  uploaded_reports: UploadedReport[];
  generated_reports: GeneratedReport[];
}

export interface UploadedReportCreatePayload {
  title: string;
  category: UploadedReportCategory;
  description?: string;
  file_name: string;
  mime_type: string;
  file_data_base64: string;
}

const BASE = '/reports';

class ReportsService {
  async uploadPatientReport(payload: UploadedReportCreatePayload): Promise<UploadedReport> {
    return apiClient.post<UploadedReport>(`${BASE}/uploaded/patient`, payload);
  }

  async uploadDoctorReport(
    patientId: string,
    payload: UploadedReportCreatePayload,
  ): Promise<UploadedReport> {
    return apiClient.post<UploadedReport>(`${BASE}/uploaded/doctor/${patientId}`, payload);
  }

  async getPatientUploadedReports(): Promise<{ items: UploadedReport[] }> {
    return apiClient.get<{ items: UploadedReport[] }>(`${BASE}/uploaded/patient`);
  }

  async getDoctorPatientUploadedReports(
    patientId: string,
  ): Promise<{ items: UploadedReport[] }> {
    return apiClient.get<{ items: UploadedReport[] }>(
      `${BASE}/uploaded/doctor/patients/${patientId}`,
    );
  }

  async getUploadedReport(reportId: string): Promise<UploadedReport> {
    return apiClient.get<UploadedReport>(`${BASE}/uploaded/${reportId}`);
  }

  async deleteUploadedReport(reportId: string): Promise<void> {
    await apiClient.delete(`${BASE}/uploaded/${reportId}`);
  }

  async generateRiskSummary(patientId: string): Promise<GeneratedReport> {
    return apiClient.post<GeneratedReport>(
      `${BASE}/generated/patients/${patientId}/risk-summary`,
      {},
      { timeoutMs: LONG_RUNNING_REQUEST_TIMEOUT_MS },
    );
  }

  async generateTreatmentSummary(patientId: string): Promise<GeneratedReport> {
    return apiClient.post<GeneratedReport>(
      `${BASE}/generated/patients/${patientId}/treatment-summary`,
      {},
      { timeoutMs: LONG_RUNNING_REQUEST_TIMEOUT_MS },
    );
  }

  async generateOverview(patientId: string): Promise<GeneratedReport> {
    return apiClient.post<GeneratedReport>(
      `${BASE}/generated/patients/${patientId}/overview`,
      {},
      { timeoutMs: LONG_RUNNING_REQUEST_TIMEOUT_MS },
    );
  }

  async getPatientGeneratedReports(): Promise<{ items: GeneratedReport[] }> {
    return apiClient.get<{ items: GeneratedReport[] }>(`${BASE}/generated/patient`);
  }

  async getDoctorPatientGeneratedReports(
    patientId: string,
  ): Promise<{ items: GeneratedReport[] }> {
    return apiClient.get<{ items: GeneratedReport[] }>(
      `${BASE}/generated/doctor/patients/${patientId}`,
    );
  }

  async getGeneratedReport(reportId: string): Promise<GeneratedReport> {
    return apiClient.get<GeneratedReport>(`${BASE}/generated/${reportId}`);
  }

  async shareGeneratedReport(reportId: string): Promise<GeneratedReport> {
    return apiClient.post<GeneratedReport>(`${BASE}/generated/${reportId}/share`, {});
  }

  getGeneratedReportDownloadPath(reportId: string): string {
    return `${BASE}/generated/${reportId}/file`;
  }

  async getPatientReportsOverview(): Promise<ReportOverviewResponse> {
    return apiClient.get<ReportOverviewResponse>(`${BASE}/patient/overview`);
  }

  async getDoctorPatientReportsOverview(patientId: string): Promise<ReportOverviewResponse> {
    return apiClient.get<ReportOverviewResponse>(
      `${BASE}/doctor/patients/${patientId}/overview`,
    );
  }
}

export const reportsService = new ReportsService();
