/**
 * Adapters: map backend API response shapes to frontend types.
 * Backend uses /api/v1/mongo and returns Mongo doc shapes; frontend expects specific UI types.
 */

/** Backend patient doc (mongo): patient_id?, full_name, age, sex, height_cm?, weight_kg?, created_at, updated_at, id */
export interface BackendPatientDoc {
  id?: string;
  _id?: string;
  patient_id?: string | null;
  full_name: string;
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  created_at?: string;
  updated_at?: string;
}

/** Map backend patient to frontend Patient/PatientListItem shape */
export function backendPatientToFrontend(doc: BackendPatientDoc): {
  id: string;
  patient_id: string;
  full_name: string;
  demographics: { age: number; gender: 'Male' | 'Female' | 'Other' };
  lab_tests?: Record<string, number>;
  vital_signs?: Record<string, number>;
  lifestyle?: Record<string, string>;
  conditions: string[];
  created_at: string;
  updated_at: string;
} {
  const id = (doc.id ?? doc._id ?? '').toString();
  const age = typeof doc.age === 'number' ? doc.age : 0;
  const sex = doc.sex ?? 'Other';
  const gender = sex === 'Male' || sex === 'Female' ? sex : 'Other';
  const displayId = (doc.patient_id && String(doc.patient_id).trim()) ? String(doc.patient_id).trim() : id;
  const fullName = (doc.full_name && String(doc.full_name).trim()) ? String(doc.full_name).trim() : `Patient ${displayId}`;
  const bmi =
    doc.weight_kg != null && doc.height_cm != null && doc.height_cm > 0
      ? doc.weight_kg / ((doc.height_cm / 100) ** 2)
      : undefined;
  return {
    id,
    patient_id: displayId,
    full_name: fullName,
    demographics: { age, gender },
    lab_tests: {},
    vital_signs: bmi != null && Number.isFinite(bmi) ? { bmi } : undefined,
    lifestyle: undefined,
    conditions: [],
    created_at: doc.created_at ?? new Date().toISOString(),
    updated_at: doc.updated_at ?? new Date().toISOString(),
  };
}

/** Frontend create/update patient payload -> backend PatientDoc shape */
export function frontendPatientToBackendCreate(data: {
  patient_id: string;
  age: number | string;
  gender: string;
  lab_tests?: Record<string, number | string>;
  vital_signs?: Record<string, number | string>;
  lifestyle?: Record<string, string>;
  conditions?: string[];
}): { patient_id?: string; full_name: string; age: number; sex: string } {
  const age = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
  const sex = (data.gender === 'Male' || data.gender === 'Female' ? data.gender : 'Other');
  const pid = data.patient_id?.trim();
  return {
    patient_id: pid || undefined,
    full_name: pid || 'Unknown',
    age: Number.isNaN(age) ? 0 : age,
    sex,
  };
}

export function frontendPatientToBackendPatch(data: {
  age?: number | string;
  gender?: string;
  [key: string]: unknown;
}): { full_name?: string; age?: number; sex?: string } {
  const patch: { full_name?: string; age?: number; sex?: string } = {};
  if (data.age !== undefined) {
    const age = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
    if (!Number.isNaN(age)) patch.age = age;
  }
  if (data.gender !== undefined && data.gender !== '') {
    patch.sex = data.gender === 'Male' || data.gender === 'Female' ? data.gender : 'Other';
  }
  return patch;
}
