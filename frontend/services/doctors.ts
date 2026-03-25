import { apiClient } from './api';
import type { Patient } from './patients';

export interface DoctorRelationship {
  is_selected: boolean;
  has_pending_request: boolean;
  patient_assignment_status: 'assigned' | 'pending' | 'unassigned';
}

export interface Doctor {
  id: string;
  doctor_id: string;
  name: string;
  specialization: string;
  email?: string;
  phone?: string;
  bio?: string;
  accepting_patients?: boolean;
  relationship?: DoctorRelationship;
  stats?: {
    patient_count: number;
  };
  created_at: string;
  updated_at: string;
}

export interface DoctorAssignmentRequest {
  id: string;
  status: string;
  note?: string;
  created_at: string;
  patient: Patient | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const BASE = '/mongo/doctors';

class DoctorsService {
  async getDoctors(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Doctor>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    const query = queryParams.toString();
    return apiClient.get<PaginatedResponse<Doctor>>(`${BASE}?${query}`);
  }

  async getDoctorMe(): Promise<Doctor> {
    return apiClient.get<Doctor>(`${BASE}/me`);
  }

  async getMyPatients(): Promise<{ items: Patient[] }> {
    return apiClient.get<{ items: Patient[] }>(`${BASE}/my-patients`);
  }

  async getAssignmentRequests(): Promise<{ items: DoctorAssignmentRequest[] }> {
    return apiClient.get<{ items: DoctorAssignmentRequest[] }>(
      `${BASE}/assignment-requests`,
    );
  }

  async requestAssignment(doctorId: string, note?: string) {
    return apiClient.post<{
      id: string;
      status: string;
      patient_id: string;
      created_at: string;
      doctor: Doctor;
    }>(`${BASE}/${doctorId}/assignment-requests`, note ? { note } : undefined);
  }

  async respondToAssignmentRequest(
    requestId: string,
    action: 'accept' | 'reject',
  ) {
    return apiClient.patch<{
      id: string;
      status: string;
      patient: Patient;
    }>(`${BASE}/assignment-requests/${requestId}`, { action });
  }

  async getDoctor(doctorId: string): Promise<Doctor> {
    return apiClient.get<Doctor>(`${BASE}/${doctorId}`);
  }
}

export const doctorsService = new DoctorsService();
