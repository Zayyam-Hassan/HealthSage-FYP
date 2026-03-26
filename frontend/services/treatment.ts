import { apiClient } from './api';

export type TreatmentStatus = 'active' | 'discontinued' | 'completed';
export type MedicationItemStatus = 'active' | 'discontinued';
export type DoctorTreatmentStatus = 'active' | 'discontinued' | 'completed';

export interface PrescriptionMedicationItem {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions: string | null;
  status: MedicationItemStatus;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  status: TreatmentStatus;
  diagnosis_context: string | null;
  general_note: string | null;
  medications: PrescriptionMedicationItem[];
  discontinued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LifestylePlan {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string | null;
  patient_name: string | null;
  status: TreatmentStatus;
  diet_plan: string | null;
  exercise_plan: string | null;
  sleep_guidance: string | null;
  stress_guidance: string | null;
  monitoring_guidance: string | null;
  follow_up_note: string | null;
  general_note: string | null;
  discontinued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionMedicationPayload {
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions?: string;
}

export interface PrescriptionPayload {
  diagnosis_context?: string;
  general_note?: string;
  medications: PrescriptionMedicationPayload[];
}

export interface LifestylePlanPayload {
  diet_plan?: string;
  exercise_plan?: string;
  sleep_guidance?: string;
  stress_guidance?: string;
  monitoring_guidance?: string;
  follow_up_note?: string;
  general_note?: string;
}

export interface PatientTreatmentOverview {
  active_prescriptions: Prescription[];
  active_lifestyle_plans: LifestylePlan[];
  prescription_history: Prescription[];
  lifestyle_history: LifestylePlan[];
}

const BASE = '/treatment';
const DOCTOR_TREATMENT_BASE = '/doctor-treatment';

export interface DoctorTreatmentAssessment {
  diagnosis: string | null;
  clinical_impression: string | null;
  risk_assessment: string | null;
  treatment_goal: string | null;
  follow_up_note: string | null;
  rationale: string | null;
}

export interface DoctorTreatmentLifestylePlan {
  diet_plan: string | null;
  exercise_plan: string | null;
  sleep_guidance: string | null;
  stress_guidance: string | null;
  monitoring_guidance: string | null;
  general_lifestyle_note: string | null;
}

export interface DoctorTreatmentMedicationItem {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions: string | null;
  status: MedicationItemStatus;
  created_at: string;
  updated_at: string;
}

export interface DoctorTreatmentPlan {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string | null;
  doctor_name: string | null;
  status: DoctorTreatmentStatus;
  assessment: DoctorTreatmentAssessment;
  medications: DoctorTreatmentMedicationItem[];
  lifestyle_plan: DoctorTreatmentLifestylePlan;
  doctor_note: string | null;
  discontinued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorTreatmentMedicationPayload {
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions?: string;
}

export interface DoctorTreatmentAssessmentPayload {
  diagnosis?: string;
  clinical_impression?: string;
  risk_assessment?: string;
  treatment_goal?: string;
  follow_up_note?: string;
  rationale?: string;
}

export interface DoctorTreatmentLifestylePayload {
  diet_plan?: string;
  exercise_plan?: string;
  sleep_guidance?: string;
  stress_guidance?: string;
  monitoring_guidance?: string;
  general_lifestyle_note?: string;
}

export interface DoctorTreatmentPlanPayload {
  assessment?: DoctorTreatmentAssessmentPayload;
  medications?: DoctorTreatmentMedicationPayload[];
  lifestyle_plan?: DoctorTreatmentLifestylePayload;
  doctor_note?: string;
}

class TreatmentService {
  async getDoctorPatientPrescriptions(patientId: string): Promise<{ items: Prescription[] }> {
    return apiClient.get<{ items: Prescription[] }>(
      `${BASE}/doctor/patients/${patientId}/prescriptions`,
    );
  }

  async createDoctorPrescription(
    patientId: string,
    payload: PrescriptionPayload,
  ): Promise<Prescription> {
    return apiClient.post<Prescription>(
      `${BASE}/doctor/patients/${patientId}/prescriptions`,
      payload,
    );
  }

  async updateDoctorPrescription(
    prescriptionId: string,
    payload: PrescriptionPayload,
  ): Promise<Prescription> {
    return apiClient.put<Prescription>(
      `${BASE}/doctor/prescriptions/${prescriptionId}`,
      payload,
    );
  }

  async discontinueDoctorPrescription(prescriptionId: string): Promise<Prescription> {
    return apiClient.patch<Prescription>(
      `${BASE}/doctor/prescriptions/${prescriptionId}/discontinue`,
      {},
    );
  }

  async getDoctorPatientLifestylePlans(
    patientId: string,
  ): Promise<{ items: LifestylePlan[] }> {
    return apiClient.get<{ items: LifestylePlan[] }>(
      `${BASE}/doctor/patients/${patientId}/lifestyle-plans`,
    );
  }

  async createDoctorLifestylePlan(
    patientId: string,
    payload: LifestylePlanPayload,
  ): Promise<LifestylePlan> {
    return apiClient.post<LifestylePlan>(
      `${BASE}/doctor/patients/${patientId}/lifestyle-plans`,
      payload,
    );
  }

  async updateDoctorLifestylePlan(
    planId: string,
    payload: LifestylePlanPayload,
  ): Promise<LifestylePlan> {
    return apiClient.put<LifestylePlan>(
      `${BASE}/doctor/lifestyle-plans/${planId}`,
      payload,
    );
  }

  async discontinueDoctorLifestylePlan(planId: string): Promise<LifestylePlan> {
    return apiClient.patch<LifestylePlan>(
      `${BASE}/doctor/lifestyle-plans/${planId}/discontinue`,
      {},
    );
  }

  async getPatientActivePrescriptions(): Promise<{ items: Prescription[] }> {
    return apiClient.get<{ items: Prescription[] }>(`${BASE}/patient/prescriptions/active`);
  }

  async getPatientPrescriptions(): Promise<{ items: Prescription[] }> {
    return apiClient.get<{ items: Prescription[] }>(`${BASE}/patient/prescriptions`);
  }

  async getPatientActiveLifestylePlans(): Promise<{ items: LifestylePlan[] }> {
    return apiClient.get<{ items: LifestylePlan[] }>(
      `${BASE}/patient/lifestyle-plans/active`,
    );
  }

  async getPatientLifestylePlans(): Promise<{ items: LifestylePlan[] }> {
    return apiClient.get<{ items: LifestylePlan[] }>(`${BASE}/patient/lifestyle-plans`);
  }

  async getPatientTreatmentOverview(): Promise<PatientTreatmentOverview> {
    return apiClient.get<PatientTreatmentOverview>(`${BASE}/patient/overview`);
  }

  async getDoctorTreatmentPlans(patientId: string): Promise<{ items: DoctorTreatmentPlan[] }> {
    return apiClient.get<{ items: DoctorTreatmentPlan[] }>(
      `${DOCTOR_TREATMENT_BASE}/patients/${patientId}`,
    );
  }

  async getDoctorActiveTreatmentSummary(
    patientId: string,
  ): Promise<{ item: DoctorTreatmentPlan | null }> {
    return apiClient.get<{ item: DoctorTreatmentPlan | null }>(
      `${DOCTOR_TREATMENT_BASE}/patients/${patientId}/active/summary`,
    );
  }

  async createDoctorTreatmentPlan(
    patientId: string,
    payload: DoctorTreatmentPlanPayload,
  ): Promise<DoctorTreatmentPlan> {
    return apiClient.post<DoctorTreatmentPlan>(
      `${DOCTOR_TREATMENT_BASE}/patients/${patientId}`,
      payload,
    );
  }

  async getDoctorTreatmentPlan(planId: string): Promise<DoctorTreatmentPlan> {
    return apiClient.get<DoctorTreatmentPlan>(`${DOCTOR_TREATMENT_BASE}/${planId}`);
  }

  async updateDoctorTreatmentPlan(
    planId: string,
    payload: DoctorTreatmentPlanPayload,
  ): Promise<DoctorTreatmentPlan> {
    return apiClient.put<DoctorTreatmentPlan>(
      `${DOCTOR_TREATMENT_BASE}/${planId}`,
      payload,
    );
  }

  async discontinueDoctorTreatmentPlan(planId: string): Promise<DoctorTreatmentPlan> {
    return apiClient.patch<DoctorTreatmentPlan>(
      `${DOCTOR_TREATMENT_BASE}/${planId}/discontinue`,
      {},
    );
  }

  async completeDoctorTreatmentPlan(planId: string): Promise<DoctorTreatmentPlan> {
    return apiClient.patch<DoctorTreatmentPlan>(
      `${DOCTOR_TREATMENT_BASE}/${planId}/complete`,
      {},
    );
  }

  async getPatientActiveDoctorTreatmentPlan(): Promise<{ item: DoctorTreatmentPlan | null }> {
    return apiClient.get<{ item: DoctorTreatmentPlan | null }>(
      `${DOCTOR_TREATMENT_BASE}/patient/active`,
    );
  }

  async getPatientDoctorTreatmentHistory(): Promise<{ items: DoctorTreatmentPlan[] }> {
    return apiClient.get<{ items: DoctorTreatmentPlan[] }>(
      `${DOCTOR_TREATMENT_BASE}/patient/history`,
    );
  }

  async getPatientDoctorTreatmentPlan(planId: string): Promise<DoctorTreatmentPlan> {
    return apiClient.get<DoctorTreatmentPlan>(
      `${DOCTOR_TREATMENT_BASE}/patient/${planId}`,
    );
  }
}

export const treatmentService = new TreatmentService();
