import { PatientFormValues, PatientFormErrors } from '@/interfaces/patient';

export type ValidatePatientFormOptions = {
  /** Doctor "Add patient" flow: require a real name separate from patient ID. */
  requireFullName?: boolean;
};

/**
 * Validates patient form data according to the specified rules
 */
export const validatePatientForm = (
  formData: PatientFormValues,
  options?: ValidatePatientFormOptions,
): PatientFormErrors => {
  const errors: PatientFormErrors = {};

  if (options?.requireFullName) {
    if (!formData.full_name?.trim()) {
      errors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length > 200) {
      errors.full_name = 'Full name must be at most 200 characters';
    }
  }

  // Required fields validation
  // patient_id
  if (!formData.patient_id.trim()) {
    errors.patient_id = 'Patient ID is required';
  } else if (formData.patient_id.length < 1 || formData.patient_id.length > 100) {
    errors.patient_id = 'Patient ID must be between 1 and 100 characters';
  }

  // age
  if (formData.age === '' || formData.age === null || formData.age === undefined) {
    errors.age = 'Age is required';
  } else {
    const ageNum = typeof formData.age === 'string' ? parseInt(formData.age, 10) : formData.age;
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      errors.age = 'Age must be an integer between 0 and 150';
    }
  }

  // gender
  if (!formData.gender) {
    errors.gender = 'Gender is required';
  } else if (!['Male', 'Female', 'Other'].includes(formData.gender)) {
    errors.gender = 'Gender must be Male, Female, or Other';
  }

  // Lab Tests validation (optional but must be valid if filled)
  errors.lab_tests = {};
  const labTests = formData.lab_tests || {};
  
  const validateNumericField = (
    value: number | string | undefined,
    fieldName: string,
    min: number = 0
  ): string | undefined => {
    if (value === '' || value === null || value === undefined) {
      return undefined; // Optional field, empty is OK
    }
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue < min) {
      return `${fieldName} must be a number greater than or equal to ${min}`;
    }
    return undefined;
  };

  const hba1cError = validateNumericField(labTests.hba1c, 'HbA1c');
  if (hba1cError) errors.lab_tests.hba1c = hba1cError;

  const fastingGlucoseError = validateNumericField(
    labTests.fasting_glucose,
    'Fasting glucose'
  );
  if (fastingGlucoseError) errors.lab_tests.fasting_glucose = fastingGlucoseError;

  const glucoseError = validateNumericField(labTests.glucose, 'Glucose');
  if (glucoseError) errors.lab_tests.glucose = glucoseError;

  const cholesterolError = validateNumericField(labTests.cholesterol, 'Cholesterol');
  if (cholesterolError) errors.lab_tests.cholesterol = cholesterolError;

  const hdlError = validateNumericField(labTests.hdl, 'HDL');
  if (hdlError) errors.lab_tests.hdl = hdlError;

  const ldlError = validateNumericField(labTests.ldl, 'LDL');
  if (ldlError) errors.lab_tests.ldl = ldlError;

  const triglyceridesError = validateNumericField(labTests.triglycerides, 'Triglycerides');
  if (triglyceridesError) errors.lab_tests.triglycerides = triglyceridesError;

  const ureaError = validateNumericField(labTests.urea, 'Urea');
  if (ureaError) errors.lab_tests.urea = ureaError;

  const creatinineError = validateNumericField(labTests.creatinine, 'Creatinine');
  if (creatinineError) errors.lab_tests.creatinine = creatinineError;

  // Vital Signs validation
  errors.vital_signs = {};
  const vitalSigns = formData.vital_signs || {};

  const bmiError = validateNumericField(vitalSigns.bmi, 'BMI', 0);
  if (bmiError) {
    errors.vital_signs.bmi = bmiError;
  } else if (vitalSigns.bmi !== '' && vitalSigns.bmi !== null && vitalSigns.bmi !== undefined) {
    const bmiNum = typeof vitalSigns.bmi === 'string' ? parseFloat(vitalSigns.bmi) : vitalSigns.bmi;
    if (bmiNum < 10 || bmiNum > 60) {
      // Soft validation warning (optional)
      // We'll just log this, not block submission
    }
  }

  // Blood pressure validation
  if (vitalSigns.systolic_bp !== '' && vitalSigns.systolic_bp !== null && vitalSigns.systolic_bp !== undefined) {
    const systolicNum = typeof vitalSigns.systolic_bp === 'string' 
      ? parseInt(vitalSigns.systolic_bp, 10) 
      : vitalSigns.systolic_bp;
    if (isNaN(systolicNum) || systolicNum < 50 || systolicNum > 250) {
      errors.vital_signs.systolic_bp = 'Systolic BP must be between 50 and 250 mmHg';
    }
  }

  if (vitalSigns.diastolic_bp !== '' && vitalSigns.diastolic_bp !== null && vitalSigns.diastolic_bp !== undefined) {
    const diastolicNum = typeof vitalSigns.diastolic_bp === 'string' 
      ? parseInt(vitalSigns.diastolic_bp, 10) 
      : vitalSigns.diastolic_bp;
    if (isNaN(diastolicNum) || diastolicNum < 30 || diastolicNum > 150) {
      errors.vital_signs.diastolic_bp = 'Diastolic BP must be between 30 and 150 mmHg';
    }
  }

  // Conditions validation
  if (formData.conditions && formData.conditions.length > 0) {
    const invalidConditions = formData.conditions.filter((c) => !c || c.trim() === '');
    if (invalidConditions.length > 0) {
      errors.conditions = 'All conditions must be non-empty strings';
    }
  }

  // Clean up empty error objects
  if (errors.lab_tests && Object.keys(errors.lab_tests).length === 0) {
    delete errors.lab_tests;
  }
  if (errors.vital_signs && Object.keys(errors.vital_signs).length === 0) {
    delete errors.vital_signs;
  }

  return errors;
};

/**
 * Check if form has any validation errors
 */
export const hasValidationErrors = (errors: PatientFormErrors): boolean => {
  if (errors.patient_id || errors.full_name || errors.age || errors.gender || errors.conditions) {
    return true;
  }
  if (errors.lab_tests && Object.keys(errors.lab_tests).length > 0) {
    return true;
  }
  if (errors.vital_signs && Object.keys(errors.vital_signs).length > 0) {
    return true;
  }
  return false;
};


