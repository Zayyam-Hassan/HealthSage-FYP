import { apiClient } from './api';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name?: string;
  doctor_name?: string;
  counterpart_name?: string;
  proposed_slots: string[];
  scheduled_at: string | null;
  requested_by_role: 'patient' | 'doctor';
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  reason: string;
  notes?: string;
  response_message?: string;
  display_date?: string | null;
  display_time?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentCreate {
  patient_id: string;
  doctor_id: string;
  proposed_slots: string[];
  requested_by_role?: 'patient' | 'doctor';
  reason: string;
  notes?: string;
}

export interface AppointmentUpdate {
  proposed_slots?: string[];
  selected_slot?: string;
  status?: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  reason?: string;
  notes?: string;
  response_message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const BASE = '/mongo/appointments';

class AppointmentsService {
  async createAppointment(data: AppointmentCreate): Promise<Appointment> {
    return apiClient.post<Appointment>(BASE, data);
  }

  async getAppointments(params?: {
    patient_id?: string;
    doctor_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Appointment>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (params?.patient_id) queryParams.append('patient_id', params.patient_id);
    if (params?.doctor_id) queryParams.append('doctor_id', params.doctor_id);
    if (params?.status) queryParams.append('status', params.status);
    return apiClient.get<PaginatedResponse<Appointment>>(
      `${BASE}?${queryParams.toString()}`,
    );
  }

  async getAppointment(appointmentId: string): Promise<Appointment> {
    return apiClient.get<Appointment>(`${BASE}/${appointmentId}`);
  }

  async updateAppointment(
    appointmentId: string,
    data: AppointmentUpdate,
  ): Promise<Appointment> {
    return apiClient.patch<Appointment>(`${BASE}/${appointmentId}`, data);
  }

  async deleteAppointment(appointmentId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${appointmentId}`);
  }
}

export const appointmentsService = new AppointmentsService();
