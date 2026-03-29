import { apiClient } from './api';

export type SchedulingWeekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export type SlotStatus =
  | 'available'
  | 'booked'
  | 'blocked'
  | 'cancelled'
  | 'completed';

export type AppointmentStatus =
  | 'booked'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface Availability {
  id: string;
  doctor_id: string;
  weekday: SchedulingWeekday;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  break_start_time: string | null;
  break_end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentSlot {
  id: string;
  doctor_id: string;
  availability_id: string | null;
  slot_date: string;
  start_datetime: string;
  end_datetime: string;
  status: SlotStatus;
  display_date: string;
  display_time: string;
  appointment_id?: string | null;
  appointment_status?: AppointmentStatus | null;
  patient_name?: string | null;
  doctor_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  slot_id: string;
  doctor_id: string;
  patient_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  counterpart_name: string | null;
  status: AppointmentStatus;
  reason: string;
  reason_for_visit: string;
  patient_note: string | null;
  doctor_note: string | null;
  booked_at: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  display_date: string | null;
  display_time: string | null;
  slot: AppointmentSlot | null;
}

export interface DoctorSlotsResponse {
  doctor: {
    id: string;
    name: string;
    specialization: string;
  };
  items: AppointmentSlot[];
}

const BASE = '/scheduling';

class AppointmentsService {
  async getDoctorAvailability(): Promise<{ items: Availability[] }> {
    return apiClient.get<{ items: Availability[] }>(`${BASE}/doctor/availability`);
  }

  async createDoctorAvailability(
    data: Omit<Availability, 'id' | 'doctor_id' | 'created_at' | 'updated_at'>,
  ): Promise<Availability> {
    return apiClient.post<Availability>(`${BASE}/doctor/availability`, data);
  }

  async updateDoctorAvailability(
    availabilityId: string,
    data: Omit<Availability, 'id' | 'doctor_id' | 'created_at' | 'updated_at'>,
  ): Promise<Availability> {
    return apiClient.put<Availability>(
      `${BASE}/doctor/availability/${availabilityId}`,
      data,
    );
  }

  async deleteDoctorAvailability(availabilityId: string): Promise<void> {
    await apiClient.delete(`${BASE}/doctor/availability/${availabilityId}`);
  }

  async generateDoctorSlots(payload?: {
    days_ahead?: number;
    start_date?: string;
  }): Promise<{
    generated_count: number;
    skipped_count: number;
    start_date: string;
    days_ahead: number;
  }> {
    return apiClient.post(`${BASE}/doctor/slots/generate`, payload ?? {});
  }

  async getDoctorSlots(params?: {
    days_ahead?: number;
    status?: SlotStatus;
  }): Promise<{ items: AppointmentSlot[] }> {
    const queryParams = new URLSearchParams();
    if (params?.days_ahead) queryParams.append('days_ahead', String(params.days_ahead));
    if (params?.status) queryParams.append('status', params.status);
    const query = queryParams.toString();
    return apiClient.get<{ items: AppointmentSlot[] }>(
      `${BASE}/doctor/slots${query ? `?${query}` : ''}`,
    );
  }

  async blockDoctorSlot(slotId: string): Promise<AppointmentSlot> {
    return apiClient.patch<AppointmentSlot>(`${BASE}/doctor/slots/${slotId}/block`, {});
  }

  async getDoctorAppointments(params?: {
    status?: AppointmentStatus;
    limit?: number;
  }): Promise<{ items: Appointment[] }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', String(params.limit));
    const query = queryParams.toString();
    return apiClient.get<{ items: Appointment[] }>(
      `${BASE}/doctor/appointments${query ? `?${query}` : ''}`,
    );
  }

  async cancelDoctorAppointment(appointmentId: string): Promise<Appointment> {
    return apiClient.patch<Appointment>(
      `${BASE}/doctor/appointments/${appointmentId}/cancel`,
      {},
    );
  }

  async completeDoctorAppointment(
    appointmentId: string,
    payload?: { doctor_note?: string },
  ): Promise<Appointment> {
    return apiClient.patch<Appointment>(
      `${BASE}/doctor/appointments/${appointmentId}/complete`,
      payload ?? {},
    );
  }

  async getDoctorPublicSlots(
    doctorId: string,
    params?: { days_ahead?: number },
  ): Promise<DoctorSlotsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.days_ahead) queryParams.append('days_ahead', String(params.days_ahead));
    const query = queryParams.toString();
    return apiClient.get<DoctorSlotsResponse>(
      `${BASE}/doctors/${doctorId}/slots${query ? `?${query}` : ''}`,
    );
  }

  async createPatientAppointment(payload: {
    slot_id: string;
    reason_for_visit?: string;
    patient_note?: string;
  }): Promise<Appointment> {
    return apiClient.post<Appointment>(`${BASE}/patient/appointments`, payload);
  }

  async getPatientAppointments(params?: {
    status?: AppointmentStatus;
    limit?: number;
  }): Promise<{ items: Appointment[] }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', String(params.limit));
    const query = queryParams.toString();
    return apiClient.get<{ items: Appointment[] }>(
      `${BASE}/patient/appointments${query ? `?${query}` : ''}`,
    );
  }

  async cancelPatientAppointment(appointmentId: string): Promise<Appointment> {
    return apiClient.patch<Appointment>(
      `${BASE}/patient/appointments/${appointmentId}/cancel`,
      {},
    );
  }

  async getAppointment(appointmentId: string): Promise<Appointment> {
    return apiClient.get<Appointment>(`${BASE}/appointments/${appointmentId}`);
  }
}

export const appointmentsService = new AppointmentsService();
