import axios, { type AxiosInstance } from 'axios';
import { env } from '../../config/env';

const fastApiClient: AxiosInstance = axios.create({
  baseURL: env.fastApiBaseUrl,
  timeout: 15000,
});

const recommendationClient: AxiosInstance = axios.create({
  baseURL: env.fastApiBaseUrl,
  timeout: 60000,
});

const chatbotClient: AxiosInstance = axios.create({
  baseURL: env.fastApiBaseUrl,
  timeout: 120000,
});

export async function callRiskExplain(patientId: string) {
  const res = await fastApiClient.get(`/risk/${encodeURIComponent(patientId)}/explain`);
  return res.data;
}

export async function callRiskPrediction(patientId: string) {
  const res = await fastApiClient.get(`/risk/${encodeURIComponent(patientId)}`);
  return res.data;
}

export async function callExplainRisk(payload: { patient_id: string; model_type?: string }) {
  const res = await fastApiClient.post('/explain-risk', payload);
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
    { params },
  );
  return res.data;
}

export async function callChatbot(path: string, payload: Record<string, any>) {
  const res = await chatbotClient.post(path, payload);
  return res.data;
}

export async function callChatbotGet(path: string) {
  const res = await chatbotClient.get(path);
  return res.data;
}

