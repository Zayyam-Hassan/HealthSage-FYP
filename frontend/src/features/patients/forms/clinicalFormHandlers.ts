import type { Dispatch, SetStateAction } from 'react';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';

type SetForm = Dispatch<SetStateAction<PatientFormValues>>;
type SetErr = Dispatch<SetStateAction<PatientFormErrors>>;

/** Exported for vitals UI and initial form hydration. */
export function bmiFromHeightWeight(heightCm: string | undefined, weightKg: string | undefined): string {
  const h = parseFloat(String(heightCm ?? '').replace(',', '.'));
  const w = parseFloat(String(weightKg ?? '').replace(',', '.'));
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return '';
  const bmi = w / (h / 100) ** 2;
  if (!Number.isFinite(bmi)) return '';
  return bmi.toFixed(1);
}

/**
 * Shared updaters for clinical profile forms — keeps field names and nested shapes aligned with PatientFormValues.
 */
export function createClinicalFormHandlers(setFormData: SetForm, setErrors: SetErr) {
  const updatePatientId = (text: string) => {
    setFormData((f) => ({ ...f, patient_id: text }));
    setErrors((e) => ({ ...e, patient_id: undefined }));
  };

  const updateFullName = (text: string) => {
    setFormData((f) => ({ ...f, full_name: text }));
    setErrors((e) => ({ ...e, full_name: undefined }));
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
    setFormData((f) => {
      const next = { ...f, height_cm: text };
      const auto = bmiFromHeightWeight(
        next.height_cm != null ? String(next.height_cm) : '',
        next.weight_kg != null ? String(next.weight_kg) : '',
      );
      return {
        ...next,
        vital_signs: {
          ...next.vital_signs,
          ...(auto ? { bmi: auto } : {}),
        },
      };
    });
  };

  const updateWeightKg = (text: string) => {
    setFormData((f) => {
      const next = { ...f, weight_kg: text };
      const auto = bmiFromHeightWeight(
        next.height_cm != null ? String(next.height_cm) : '',
        next.weight_kg != null ? String(next.weight_kg) : '',
      );
      return {
        ...next,
        vital_signs: {
          ...next.vital_signs,
          ...(auto ? { bmi: auto } : {}),
        },
      };
    });
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
    updateFullName,
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
