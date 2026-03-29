import type { Dispatch, SetStateAction } from 'react';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';

type SetForm = Dispatch<SetStateAction<PatientFormValues>>;
type SetErr = Dispatch<SetStateAction<PatientFormErrors>>;

/**
 * Shared updaters for clinical profile forms — keeps field names and nested shapes aligned with PatientFormValues.
 */
export function createClinicalFormHandlers(setFormData: SetForm, setErrors: SetErr) {
  const updatePatientId = (text: string) => {
    setFormData((f) => ({ ...f, patient_id: text }));
    setErrors((e) => ({ ...e, patient_id: undefined }));
  };

  const updateAge = (text: string) => {
    setFormData((f) => ({ ...f, age: text }));
    setErrors((e) => ({ ...e, age: undefined }));
  };

  const updateGender = (value: 'Male' | 'Female' | 'Other') => {
    setFormData((f) => ({ ...f, gender: value }));
    setErrors((e) => ({ ...e, gender: undefined }));
  };

  const updateHeightCm = (text: string) => {
    setFormData((f) => ({ ...f, height_cm: text }));
  };

  const updateWeightKg = (text: string) => {
    setFormData((f) => ({ ...f, weight_kg: text }));
  };

  const updateLab = (key: keyof NonNullable<PatientFormValues['lab_tests']>, value: string) => {
    setFormData((f) => ({
      ...f,
      lab_tests: { ...f.lab_tests, [key]: value },
    }));
    setErrors((e) => ({
      ...e,
      lab_tests: { ...e.lab_tests, [key]: undefined },
    }));
  };

  const updateVital = (key: keyof NonNullable<PatientFormValues['vital_signs']>, value: string) => {
    setFormData((f) => ({
      ...f,
      vital_signs: { ...f.vital_signs, [key]: value },
    }));
    setErrors((e) => ({
      ...e,
      vital_signs: { ...e.vital_signs, [key]: undefined },
    }));
  };

  const updateLifestyle = (
    key: keyof NonNullable<PatientFormValues['lifestyle']>,
    value: string,
  ) => {
    setFormData((f) => ({
      ...f,
      lifestyle: { ...f.lifestyle, [key]: value },
    }));
    setErrors((e) => ({
      ...e,
      lifestyle: { ...e.lifestyle, [key]: undefined },
    }));
  };

  const updateConditions = (conditions: string[]) => {
    setFormData((f) => ({ ...f, conditions }));
    setErrors((e) => ({ ...e, conditions: undefined }));
  };

  return {
    updatePatientId,
    updateAge,
    updateGender,
    updateHeightCm,
    updateWeightKg,
    updateLab,
    updateVital,
    updateLifestyle,
    updateConditions,
  };
}

export type ClinicalFormHandlers = ReturnType<typeof createClinicalFormHandlers>;
