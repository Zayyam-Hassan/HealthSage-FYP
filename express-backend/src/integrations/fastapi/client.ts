import axios, { type AxiosInstance } from 'axios';
import { env } from '../../config/env';

const STANDARD_FASTAPI_TIMEOUT_MS = 15_000;
export const LONG_RUNNING_FASTAPI_TIMEOUT_MS = 180_000;

const fastApiClient: AxiosInstance = axios.create({
  baseURL: env.fastApiBaseUrl,
  timeout: STANDARD_FASTAPI_TIMEOUT_MS,
});

const recommendationClient: AxiosInstance = axios.create({
  baseURL: env.fastApiBaseUrl,
  timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS,
});

const chatbotClient: AxiosInstance = axios.create({
  baseURL: env.fastApiBaseUrl,
  timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS,
});

export async function callRiskExplain(
  patientId: string,
  timeoutMs = STANDARD_FASTAPI_TIMEOUT_MS,
) {
  const res = await fastApiClient.get(`/risk/${encodeURIComponent(patientId)}/explain`, {
    timeout: timeoutMs,
  });
  return res.data;
}

export async function callRiskPrediction(
  patientId: string,
  timeoutMs = STANDARD_FASTAPI_TIMEOUT_MS,
) {
  const res = await fastApiClient.get(`/risk/${encodeURIComponent(patientId)}`, {
    timeout: timeoutMs,
  });
  return res.data;
}

export async function callExplainRisk(payload: { patient_id: string; model_type?: string }) {
  const res = await fastApiClient.post('/explain-risk', payload);
  return res.data;
}

export async function callWhatIfBaseline(patientId: string) {
  const res = await fastApiClient.get(`/what-if/patients/${encodeURIComponent(patientId)}/baseline`);
  return res.data;
}

export async function callWhatIfCompare(
  patientId: string,
  payload: { scenario_name?: string; modifications: Record<string, unknown> },
) {
  const res = await fastApiClient.post(
    `/what-if/patients/${encodeURIComponent(patientId)}/compare`,
    payload,
  );
  return res.data;
}

export async function callCompatibility(patientId: string, medicationId: string) {
  const res = await fastApiClient.get(
    `/compatibility/${encodeURIComponent(patientId)}/${encodeURIComponent(medicationId)}`,
  );
  return res.data;
}

export async function callRecommendMedication(payload: Record<string, any>) {
  const patientId = String(payload.patient_id ?? payload.patientId ?? '');
  if (!patientId) {
    throw new Error('patient_id is required for medication recommendations');
  }

  const { patient_id: _patientId, patientId: _legacyPatientId, ...body } = payload;
  const res = await recommendationClient.post(
    `/recommendations/medication/${encodeURIComponent(patientId)}`,
    body,
    { timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS },
  );
  return res.data;
}

export async function callRecommendMedicationForPatient(
  patientId: string,
  payload?: Record<string, any>,
) {
  const res = await recommendationClient.post(
    `/recommendations/medication/${encodeURIComponent(patientId)}`,
    payload ?? {},
    { timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS },
  );
  return res.data;
}

export async function callRecommendLifestyle(payload: Record<string, any>) {
  const patientId = String(payload.patient_id ?? payload.patientId ?? '');
  if (!patientId) {
    throw new Error('patient_id is required for lifestyle recommendations');
  }

  const params =
    payload.store === undefined
      ? undefined
      : { store: Boolean(payload.store) };

  const res = await recommendationClient.post(
    `/recommendations/lifestyle/${encodeURIComponent(patientId)}`,
    undefined,
    {
      params,
      timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS,
    },
  );
  return res.data;
}

export async function callChatbot(path: string, payload: Record<string, any>) {
  const res = await chatbotClient.post(path, payload, {
    timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS,
  });
  return res.data;
}

export async function callChatbotGet(path: string) {
  const res = await chatbotClient.get(path, {
    timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS,
  });
  return res.data;
}

export async function callDiagnosisIdentifier(doctorQuery: string) {
  const res = await chatbotClient.post('/chatbot/identify-diagnosis', {
    doctor_query: doctorQuery,
  }, {
    timeout: LONG_RUNNING_FASTAPI_TIMEOUT_MS,
  });
  return res.data as {
    is_diagnosis_or_assessment?: boolean;
    confidence?: number;
    rationale?: string;
  };
}

