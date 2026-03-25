/**
 * Patient Form Data Model
 * Single source of truth for patient form structure
 */

export interface PatientFormValues {
  patient_id: string;
  age: number | string;
  gender: "Male" | "Female" | "Other" | "";
  height_cm?: number | string;
  weight_kg?: number | string;

  lab_tests: {
    hba1c?: number | string;
    fasting_glucose?: number | string;
    glucose?: number | string;
    cholesterol?: number | string;
    hdl?: number | string;
    ldl?: number | string;
    triglycerides?: number | string;
    urea?: number | string;
    creatinine?: number | string;
  };

  vital_signs: {
    bmi?: number | string;
    systolic_bp?: number | string;
    diastolic_bp?: number | string;
  };

  lifestyle: {
    smoking?: string;
    drinking?: string;
    exercise?: string;
  };

  conditions: string[];
}

/**
 * Validation errors for patient form
 */
export interface PatientFormErrors {
  patient_id?: string;
  age?: string;
  gender?: string;
  height_cm?: string;
  weight_kg?: string;
  lab_tests?: {
    hba1c?: string;
    fasting_glucose?: string;
    glucose?: string;
    cholesterol?: string;
    hdl?: string;
    ldl?: string;
    triglycerides?: string;
    urea?: string;
    creatinine?: string;
  };
  vital_signs?: {
    bmi?: string;
    systolic_bp?: string;
    diastolic_bp?: string;
  };
  lifestyle?: {
    smoking?: string;
    drinking?: string;
    exercise?: string;
  };
  conditions?: string;
}


