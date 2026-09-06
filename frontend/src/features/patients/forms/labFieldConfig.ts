import type { PatientFormValues } from '@/interfaces/patient';

export type LabFieldKey = keyof NonNullable<PatientFormValues['lab_tests']>;

export type LabFieldDef = {
  key: LabFieldKey;
  label: string;
  placeholder: string;
};

/** Doctor create/edit — matches app/patients/new and edit (no fasting glucose field in UI). */
export const LAB_FIELDS_DOCTOR: LabFieldDef[] = [
  { key: 'hba1c', label: 'HbA1c (%)', placeholder: '7.2' },
  { key: 'glucose', label: 'Glucose (mg/dL)', placeholder: '145' },
  { key: 'cholesterol', label: 'Total Cholesterol (mg/dL)', placeholder: '200' },
  { key: 'hdl', label: 'HDL (mg/dL)', placeholder: '50' },
  { key: 'ldl', label: 'LDL (mg/dL)', placeholder: '130' },
  { key: 'triglycerides', label: 'Triglycerides (mg/dL)', placeholder: '150' },
  { key: 'urea', label: 'Urea (mg/dL)', placeholder: '20' },
  { key: 'creatinine', label: 'Creatinine (mg/dL)', placeholder: '1.0' },
];

/** Patient self-assessment step — includes fasting glucose (same keys as updateMyClinicalProfile payload). */
export const LAB_FIELDS_SELF_ASSESSMENT: LabFieldDef[] = [
  { key: 'hba1c', label: 'HbA1c (%)', placeholder: '6.8' },
  { key: 'fasting_glucose', label: 'Fasting Glucose', placeholder: '95' },
  { key: 'glucose', label: 'Random Glucose', placeholder: '140' },
  { key: 'cholesterol', label: 'Total Cholesterol', placeholder: '190' },
  { key: 'hdl', label: 'HDL', placeholder: '48' },
  { key: 'ldl', label: 'LDL', placeholder: '120' },
  { key: 'triglycerides', label: 'Triglycerides', placeholder: '160' },
  { key: 'urea', label: 'Urea', placeholder: '28' },
  { key: 'creatinine', label: 'Creatinine', placeholder: '1.0' },
];
