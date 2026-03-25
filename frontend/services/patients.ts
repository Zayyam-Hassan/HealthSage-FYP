import { apiClient } from './api';
import type { PatientFormValues } from '@/interfaces/patient';

export interface PatientAssignment {
  status: 'assigned' | 'pending' | 'unassigned';
  doctor: {
    id: string;
    doctor_id: string;
    name: string;
    specialization: string;
    email?: string;
    phone?: string;
  } | null;
  pending_request?: {
    id: string;
    doctor_id: string;
    status: string;
    created_at: string;
  } | null;
}

export interface Patient {
  id: string;
  patient_id: string;
  full_name: string;
  demographics: {
    age: number;
    gender: 'Male' | 'Female' | 'Other';
  };
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  sex: 'Male' | 'Female' | 'Other';
  height_cm?: number;
  weight_kg?: number;
  lab_tests?: {
    hba1c?: number;
    fasting_glucose?: number;
    glucose?: number;
    cholesterol?: number;
    hdl?: number;
    ldl?: number;
    triglycerides?: number;
    urea?: number;
    creatinine?: number;
  };
  vital_signs?: {
    bmi?: number;
    systolic_bp?: number;
    diastolic_bp?: number;
    height_cm?: number;
    weight_kg?: number;
  };
  lifestyle?: {
    smoking?: string;
    drinking?: string;
    exercise?: string;
  };
  conditions: string[];
  assignment: PatientAssignment;
  is_self?: boolean;
  created_at: string;
  updated_at: string;
}

export type PatientListItem = Patient;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const BASE = '/mongo/patients';

function toBackendPatientPayload(data: PatientFormValues) {
  const parseNumber = (value?: number | string) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    patient_id: data.patient_id?.trim() || undefined,
    full_name: data.patient_id?.trim() || undefined,
    age: parseNumber(data.age),
    gender: data.gender || undefined,
    height_cm: parseNumber(data.height_cm),
    weight_kg: parseNumber(data.weight_kg),
    lab_tests: {
      hba1c: parseNumber(data.lab_tests?.hba1c),
      fasting_glucose: parseNumber(data.lab_tests?.fasting_glucose),
      glucose: parseNumber(data.lab_tests?.glucose),
      cholesterol: parseNumber(data.lab_tests?.cholesterol),
      hdl: parseNumber(data.lab_tests?.hdl),
      ldl: parseNumber(data.lab_tests?.ldl),
      triglycerides: parseNumber(data.lab_tests?.triglycerides),
      urea: parseNumber(data.lab_tests?.urea),
      creatinine: parseNumber(data.lab_tests?.creatinine),
    },
    vital_signs: {
      bmi: parseNumber(data.vital_signs?.bmi),
      systolic_bp: parseNumber(data.vital_signs?.systolic_bp),
      diastolic_bp: parseNumber(data.vital_signs?.diastolic_bp),
    },
    lifestyle: {
      smoking: data.lifestyle?.smoking || undefined,
      drinking: data.lifestyle?.drinking || undefined,
      exercise: data.lifestyle?.exercise || undefined,
    },
    conditions: data.conditions ?? [],
  };
}

class PatientsService {
  async createPatient(data: PatientFormValues): Promise<Patient> {
    return apiClient.post<Patient>(BASE, toBackendPatientPayload(data));
  }

  async getPatients(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PatientListItem>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    const query = queryParams.toString();
    return apiClient.get<PaginatedResponse<PatientListItem>>(`${BASE}?${query}`);
  }

  async getMyPatientProfile(): Promise<Patient> {
    return apiClient.get<Patient>(`${BASE}/me`);
  }

  async getPatient(patientId: string): Promise<Patient> {
    return apiClient.get<Patient>(`${BASE}/${patientId}`);
  }

  async updateMyClinicalProfile(data: PatientFormValues): Promise<Patient> {
    return apiClient.patch<Patient>(
      `${BASE}/me/clinical-profile`,
      toBackendPatientPayload(data),
    );
  }

  async updatePatient(patientId: string, data: PatientFormValues): Promise<Patient> {
    return apiClient.patch<Patient>(
      `${BASE}/${patientId}`,
      toBackendPatientPayload(data),
    );
  }

  async deletePatient(patientId: string): Promise<void> {
    await apiClient.delete(`${BASE}/${patientId}`);
  }
}

export const patientsService = new PatientsService();
