import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { BlobModel, type BlobDocument } from '../models/Blob';
import { Doctor, type DoctorDocument } from '../models/Doctor';
import { Patient, type PatientDocument } from '../models/Patient';
import { Report, type ReportDocument } from '../models/Report';
import {
  UploadedReport,
  type UploadedReportCategory,
  type UploadedReportDocument,
  type UploadedByRole,
} from '../models/UploadedReport';
import { Prescription } from '../models/Prescription';
import { LifestylePlan } from '../models/LifestylePlan';
import { callRiskExplain, callRiskPrediction } from '../integrations/fastapi/client';
import {
  createNotificationForDoctorProfile,
  createNotificationForPatientProfile,
} from './notificationsService';
import { writeReportPdf } from '../utils/reportPdf';

const SUPPORTED_UPLOAD_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadedReportInput {
  title: string;
  category: UploadedReportCategory;
  description?: string;
  file_name: string;
  mime_type: string;
  file_data_base64: string;
}

export interface UploadedReportResponse {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  title: string;
  category: UploadedReportCategory;
  description: string | null;
  uploaded_by_role: UploadedByRole;
  uploaded_by_user_id: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  file_url: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedReportResponse {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  report_type: string;
  title: string;
  summary: string | null;
  structured_payload: Record<string, unknown>;
  generated_by: string | null;
  source_reference: string | null;
  attachment_url: string | null;
  is_sent_to_patient: boolean;
  sent_to_patient_at: string | null;
  last_sent_at: string | null;
  send_count: number;
  created_at: string;
  updated_at: string;
}

export class ReportModuleError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function toObjectId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function trimOrUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function ensureString(value: string | undefined, field: string) {
  const trimmed = trimOrUndefined(value);
  if (!trimmed) {
    throw new ReportModuleError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `${field} is required`,
    );
  }
  return trimmed;
}

function normalizeBase64(value: string) {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(',');
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

function buildUploadedFileUrl(reportId: string) {
  return `/reports/uploaded/${reportId}/file`;
}

function buildGeneratedFileUrl(reportId: string) {
  return `/reports/generated/${reportId}/file`;
}

function mapUploadedReport(report: UploadedReportDocument): UploadedReportResponse {
  return {
    id: report.id,
    patient_id: report.patient_id.toString(),
    doctor_id: report.doctor_id?.toString() ?? null,
    title: report.title,
    category: report.category,
    description: report.description ?? null,
    uploaded_by_role: report.uploaded_by_role,
    uploaded_by_user_id: report.uploaded_by_user_id.toString(),
    file_name: report.file_name,
    mime_type: report.mime_type,
    file_size: report.file_size ?? null,
    file_url: buildUploadedFileUrl(report.id),
    created_at: report.created_at.toISOString(),
    updated_at: report.updated_at.toISOString(),
  };
}

function mapGeneratedReport(report: ReportDocument): GeneratedReportResponse {
  return {
    id: report.id,
    patient_id: report.patient_id.toString(),
    doctor_id: report.doctor_id?.toString() ?? null,
    report_type: report.type,
    title: report.title,
    summary: report.summary ?? null,
    structured_payload: (report.content ?? {}) as Record<string, unknown>,
    generated_by: report.generated_by ?? null,
    source_reference: report.source_reference ?? null,
    attachment_url: report.attachment_path ? buildGeneratedFileUrl(report.id) : null,
    is_sent_to_patient: Boolean(report.is_sent_to_patient),
    sent_to_patient_at: report.sent_to_patient_at?.toISOString?.() ?? null,
    last_sent_at: report.last_sent_at?.toISOString?.() ?? null,
    send_count: report.send_count ?? 0,
    created_at: report.created_at.toISOString(),
    updated_at: report.updated_at.toISOString(),
  };
}

function sanitizeGeneratedPayloadForPatient(payload: Record<string, unknown>) {
  const blockedExactKeys = new Set([
    'latest_risk_summary',
    'risk_narrative',
    'risk_drivers',
    'explainability',
    'doctor_considerations',
    'evidence_summary',
    'risk_snapshot',
    'top_features',
  ]);

  const blockedRegex = /(risk|explain|driver|contributor|feature_importance|snapshot)/i;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload ?? {})) {
    if (blockedExactKeys.has(key) || blockedRegex.test(key)) continue;

    if (key === 'patient_metrics_context' && Array.isArray(value)) {
      sanitized[key] = value.filter((line) => !/risk/i.test(String(line)));
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

async function getDoctorByUserId(userId: string) {
  return Doctor.findOne({ user_id: toObjectId(userId) });
}

async function getPatientByUserId(userId: string) {
  return Patient.findOne({ user_id: toObjectId(userId) });
}

async function requireDoctorForUser(userId: string): Promise<DoctorDocument> {
  const doctor = await getDoctorByUserId(userId);
  if (!doctor) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Doctor profile not found');
  }
  return doctor;
}

async function requirePatientForUser(userId: string): Promise<PatientDocument> {
  const patient = await getPatientByUserId(userId);
  if (!patient) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Patient profile not found');
  }
  return patient;
}

async function requireManagedPatient(
  doctorUserId: string,
  patientId: string,
): Promise<{ doctor: DoctorDocument; patient: PatientDocument }> {
  const doctor = await requireDoctorForUser(doctorUserId);
  if (!mongoose.isValidObjectId(patientId)) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Patient not found');
  }
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Patient not found');
  }
  if (patient.primary_doctor_id?.toString() !== doctor.id) {
    throw new ReportModuleError(StatusCodes.FORBIDDEN, 'Forbidden');
  }
  return { doctor, patient };
}

function flattenPayload(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenPayload(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      const nested = flattenPayload(item);
      if (nested.length === 0) return [];
      return [`${key.replace(/_/g, ' ')}: ${nested.join('; ')}`];
    });
  }
  return [];
}

function buildPdfSectionsFromPayload(
  summary: string,
  payload: Record<string, unknown>,
): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = [];
  if (summary.trim()) {
    sections.push({ heading: 'Summary', body: summary.trim() });
  }

  for (const [key, value] of Object.entries(payload)) {
    const body = flattenPayload(value).join('\n');
    if (!body.trim()) continue;
    sections.push({
      heading: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      body,
    });
  }

  return sections.length > 0
    ? sections
    : [{ heading: 'Summary', body: 'Generated report content is available in the application.' }];
}

async function ensureGeneratedPdf(report: ReportDocument) {
  const filePath = await writeReportPdf(
    report.id,
    report.title,
    buildPdfSectionsFromPayload(report.summary ?? '', report.content ?? {}),
  );

  report.attachment_path = filePath;
  report.attachment_url = buildGeneratedFileUrl(report.id);
  await report.save();
}

async function writeUploadedFile(
  fileName: string,
  mimeType: string,
  fileDataBase64: string,
  uploadedByUserId: mongoose.Types.ObjectId,
): Promise<BlobDocument> {
  if (!SUPPORTED_UPLOAD_TYPES[mimeType.toLowerCase()]) {
    throw new ReportModuleError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Unsupported file type. Only PDF, JPG, JPEG, and PNG are allowed',
    );
  }

  const normalizedBase64 = normalizeBase64(fileDataBase64);
  let buffer: Buffer;
  try {
    buffer = Buffer.from(normalizedBase64, 'base64');
  } catch {
    throw new ReportModuleError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Invalid file payload',
    );
  }

  if (!buffer.length) {
    throw new ReportModuleError(StatusCodes.UNPROCESSABLE_ENTITY, 'Missing file content');
  }

  if (buffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new ReportModuleError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'File exceeds the 10MB limit',
    );
  }

  const blob = new BlobModel({
    storage_backend: 'mongo',
    storage_key: 'pending',
    filename: fileName,
    content_type: mimeType,
    size_bytes: buffer.length,
    data_buffer: buffer,
    uploaded_by: uploadedByUserId,
  });
  blob.storage_key = `mongo:${blob.id}`;
  await blob.save();
  return blob;
}

async function getAccessibleUploadedReport(
  userRole: 'doctor' | 'patient' | 'admin',
  userId: string,
  reportId: string,
): Promise<UploadedReportDocument> {
  if (!mongoose.isValidObjectId(reportId)) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Uploaded report not found');
  }

  const report = await UploadedReport.findById(reportId);
  if (!report) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Uploaded report not found');
  }

  if (userRole === 'admin') return report;

  if (userRole === 'patient') {
    const patient = await requirePatientForUser(userId);
    if (report.patient_id.toString() !== patient.id) {
      throw new ReportModuleError(StatusCodes.FORBIDDEN, 'Forbidden');
    }
    const shouldBeVisibleByDefault =
      report.uploaded_by_role === 'doctor' && report.category === 'doctor_sent';
    if (!report.is_sent_to_patient && !shouldBeVisibleByDefault) {
      throw new ReportModuleError(StatusCodes.FORBIDDEN, 'This report is not shared with the patient');
    }
    return report;
  }

  const doctor = await requireDoctorForUser(userId);
  const patient = await Patient.findById(report.patient_id);
  if (!patient || patient.primary_doctor_id?.toString() !== doctor.id) {
    throw new ReportModuleError(StatusCodes.FORBIDDEN, 'Forbidden');
  }
  return report;
}

async function getAccessibleGeneratedReport(
  userRole: 'doctor' | 'patient' | 'admin',
  userId: string,
  reportId: string,
): Promise<ReportDocument> {
  if (!mongoose.isValidObjectId(reportId)) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Generated report not found');
  }

  const report = await Report.findById(reportId);
  if (!report) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Generated report not found');
  }

  if (userRole === 'admin') return report;

  if (userRole === 'patient') {
    const patient = await requirePatientForUser(userId);
    if (report.patient_id.toString() !== patient.id) {
      throw new ReportModuleError(StatusCodes.FORBIDDEN, 'Forbidden');
    }
    if (!report.is_sent_to_patient) {
      throw new ReportModuleError(StatusCodes.FORBIDDEN, 'This report is not shared with the patient');
    }
    return report;
  }

  const doctor = await requireDoctorForUser(userId);
  const patient = await Patient.findById(report.patient_id);
  if (!patient || patient.primary_doctor_id?.toString() !== doctor.id) {
    throw new ReportModuleError(StatusCodes.FORBIDDEN, 'Forbidden');
  }
  return report;
}

export async function uploadReportForPatient(
  userId: string,
  input: UploadedReportInput,
): Promise<UploadedReportResponse> {
  const patient = await requirePatientForUser(userId);
  const blob = await writeUploadedFile(
    ensureString(input.file_name, 'file_name'),
    ensureString(input.mime_type, 'mime_type'),
    ensureString(input.file_data_base64, 'file_data_base64'),
    toObjectId(userId),
  );

  const report = await UploadedReport.create({
    patient_id: patient._id,
    doctor_id: patient.primary_doctor_id ?? null,
    uploaded_by_user_id: toObjectId(userId),
    uploaded_by_role: 'patient',
    title: ensureString(input.title, 'title'),
    category: input.category,
    description: trimOrUndefined(input.description),
    blob_id: blob._id,
    file_name: blob.filename,
    mime_type: blob.content_type,
    file_size: blob.size_bytes,
    is_sent_to_patient: true,
    sent_to_patient_at: new Date(),
  });

  console.info(`[reports] uploaded report created by patient report=${report.id}`);

  await createNotificationForDoctorProfile(patient.primary_doctor_id, {
    type: 'report_uploaded_by_patient',
    title: 'New patient report uploaded',
    message: `${patient.full_name} uploaded "${report.title}".`,
    href: `/reports?patientId=${patient.id}`,
    data: {
      report_id: report.id,
      patient_id: patient.id,
      doctor_id: patient.primary_doctor_id?.toString() ?? null,
      uploaded_by_role: 'patient',
      category: report.category,
    },
  }).catch(() => null);

  return mapUploadedReport(report);
}

export async function uploadReportForDoctor(
  userId: string,
  patientId: string,
  input: UploadedReportInput,
): Promise<UploadedReportResponse> {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const blob = await writeUploadedFile(
    ensureString(input.file_name, 'file_name'),
    ensureString(input.mime_type, 'mime_type'),
    ensureString(input.file_data_base64, 'file_data_base64'),
    toObjectId(userId),
  );

  const report = await UploadedReport.create({
    patient_id: patient._id,
    doctor_id: doctor._id,
    uploaded_by_user_id: toObjectId(userId),
    uploaded_by_role: 'doctor',
    title: ensureString(input.title, 'title'),
    category: input.category,
    description: trimOrUndefined(input.description),
    blob_id: blob._id,
    file_name: blob.filename,
    mime_type: blob.content_type,
    file_size: blob.size_bytes,
    is_sent_to_patient: true,
    sent_to_patient_at: new Date(),
  });

  console.info(`[reports] uploaded report created by doctor report=${report.id} patient=${patient.id}`);

  await createNotificationForPatientProfile(patient._id, {
    type: 'report_uploaded_by_doctor',
    title: 'New report shared',
    message: `${doctor.name} uploaded "${report.title}" to your records.`,
    href: '/reports',
    data: {
      report_id: report.id,
      patient_id: patient.id,
      doctor_id: doctor.id,
      uploaded_by_role: 'doctor',
      category: report.category,
    },
  }).catch(() => null);

  return mapUploadedReport(report);
}

export async function listUploadedReportsForPatient(userId: string) {
  const patient = await requirePatientForUser(userId);
  const items = await UploadedReport.find({
    patient_id: patient._id,
    $or: [
      { is_sent_to_patient: true },
      { uploaded_by_role: 'doctor', category: 'doctor_sent' },
    ],
  }).sort({ created_at: -1 });
  return { items: items.map(mapUploadedReport) };
}

export async function listUploadedReportsForDoctorPatient(userId: string, patientId: string) {
  const { patient } = await requireManagedPatient(userId, patientId);
  const items = await UploadedReport.find({
    patient_id: patient._id,
  }).sort({ created_at: -1 });
  return { items: items.map(mapUploadedReport) };
}

export async function getUploadedReportById(
  userRole: 'doctor' | 'patient' | 'admin',
  userId: string,
  reportId: string,
) {
  return mapUploadedReport(await getAccessibleUploadedReport(userRole, userId, reportId));
}

export async function deleteUploadedReportById(
  userRole: 'doctor' | 'patient' | 'admin',
  userId: string,
  reportId: string,
) {
  const report = await getAccessibleUploadedReport(userRole, userId, reportId);
  const blob = await BlobModel.findById(report.blob_id);
  if (blob?.storage_backend === 'local' && blob.storage_key) {
    const filePath = path.join(process.cwd(), blob.storage_key);
    await fs.promises.unlink(filePath).catch(() => null);
  }
  if (blob) {
    await blob.deleteOne();
  }
  await report.deleteOne();
}

export async function getUploadedReportBlob(
  userRole: 'doctor' | 'patient' | 'admin',
  userId: string,
  reportId: string,
) {
  const report = await getAccessibleUploadedReport(userRole, userId, reportId);
  const blob = await BlobModel.findById(report.blob_id);
  if (!blob) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Uploaded report file not found');
  }

  if (blob.data_buffer?.length) {
    return {
      buffer: Buffer.from(blob.data_buffer),
      fileName: report.file_name,
      mimeType: report.mime_type,
    };
  }

  if (!blob.storage_key) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Uploaded report file not found');
  }

  const filePath = path.join(process.cwd(), blob.storage_key);
  if (!fs.existsSync(filePath)) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Uploaded report file not found');
  }
  return {
    buffer: await fs.promises.readFile(filePath),
    fileName: report.file_name,
    mimeType: report.mime_type,
  };
}

async function createGeneratedReportRecord(args: {
  patient: PatientDocument;
  doctor: DoctorDocument;
  createdByUserId: string;
  reportType: string;
  title: string;
  summary: string;
  structuredPayload: Record<string, unknown>;
  sourceReference?: string;
}) {
  const report = await Report.create({
    patient_id: args.patient._id,
    doctor_id: args.doctor._id,
    created_by_user_id: toObjectId(args.createdByUserId),
    title: args.title,
    type: args.reportType,
    summary: args.summary,
    content: args.structuredPayload,
    generated_at: new Date(),
    generated_by: 'system',
    source_reference: args.sourceReference,
    is_sent_to_patient: false,
    sent_to_patient_at: null,
    last_sent_at: null,
    send_count: 0,
  });

  await ensureGeneratedPdf(report);

  console.info(
    `[reports] generated report created type=${args.reportType} report=${report.id} patient=${args.patient.id}`,
  );

  return mapGeneratedReport(report);
}

function patientSnapshot(patient: PatientDocument) {
  return {
    patient_id: patient.patient_id ?? patient.id,
    full_name: patient.full_name,
    age: patient.age ?? null,
    sex: patient.sex ?? null,
    conditions: patient.conditions ?? [],
    lab_tests: patient.lab_tests ?? {},
    vital_signs: patient.vital_signs ?? {},
    lifestyle: patient.lifestyle ?? {},
  };
}

export async function generateRiskSummaryReport(userId: string, patientId: string) {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const [prediction, explanation] = await Promise.all([
    callRiskPrediction(patient.id).catch(() => null),
    callRiskExplain(patient.id).catch(() => null),
  ]);

  if (!prediction && !explanation) {
    throw new ReportModuleError(
      StatusCodes.BAD_GATEWAY,
      'Missing source data for risk summary generation',
    );
  }

  const riskScore = prediction?.risk_score ?? explanation?.risk_score ?? null;
  const riskLabel = prediction?.risk_label ?? explanation?.risk_label ?? 'unknown';
  const topFeatures = explanation?.explanation?.top_features ?? [];
  const summary = `Latest risk assessment: ${riskLabel} risk${typeof riskScore === 'number' ? ` with score ${riskScore}` : ''}.`;

  return createGeneratedReportRecord({
    patient,
    doctor,
    createdByUserId: userId,
    reportType: 'risk_prediction',
    title: `${patient.full_name} Risk Summary`,
    summary,
    structuredPayload: {
      patient_snapshot: patientSnapshot(patient),
      risk_score: riskScore,
      risk_label: riskLabel,
      explanation: explanation?.explanation ?? null,
      top_features: topFeatures,
    },
    sourceReference: prediction?.model_name ?? explanation?.model_name ?? undefined,
  });
}

export async function generateTreatmentSummaryReport(userId: string, patientId: string) {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const [prescription, plan] = await Promise.all([
    Prescription.findOne({
      patient_id: patient._id,
      doctor_id: doctor._id,
      status: 'active',
    }).sort({ created_at: -1 }),
    LifestylePlan.findOne({
      patient_id: patient._id,
      doctor_id: doctor._id,
      status: 'active',
    }).sort({ created_at: -1 }),
  ]);

  if (!prescription && !plan) {
    throw new ReportModuleError(
      StatusCodes.CONFLICT,
      'No active treatment data is available for this patient',
    );
  }

  const summary = [
    prescription ? `${prescription.medications.length} active medication item(s)` : '',
    plan ? 'active lifestyle guidance available' : '',
  ]
    .filter(Boolean)
    .join(' and ');

  return createGeneratedReportRecord({
    patient,
    doctor,
    createdByUserId: userId,
    reportType: 'treatment_summary',
    title: `${patient.full_name} Treatment Summary`,
    summary: summary || 'Current treatment summary',
    structuredPayload: {
      patient_snapshot: patientSnapshot(patient),
      medications:
        prescription?.medications.map((item) => ({
          medication_name: item.medication_name,
          dosage: item.dosage,
          frequency: item.frequency,
          route: item.route,
          duration: item.duration,
          timing_instructions: item.timing_instructions,
          special_instructions: item.special_instructions ?? null,
        })) ?? [],
      lifestyle_plan: plan
        ? {
            diet_plan: plan.diet_plan ?? null,
            exercise_plan: plan.exercise_plan ?? null,
            sleep_guidance: plan.sleep_guidance ?? null,
            stress_guidance: plan.stress_guidance ?? null,
            monitoring_guidance: plan.monitoring_guidance ?? null,
            follow_up_note: plan.follow_up_note ?? null,
            general_note: plan.general_note ?? null,
          }
        : null,
    },
  });
}

export async function generatePatientOverviewReport(userId: string, patientId: string) {
  const { doctor, patient } = await requireManagedPatient(userId, patientId);
  const [uploadedCount, generatedCount, latestPrescription, latestPlan] = await Promise.all([
    UploadedReport.countDocuments({ patient_id: patient._id }),
    Report.countDocuments({ patient_id: patient._id }),
    Prescription.findOne({ patient_id: patient._id, doctor_id: doctor._id }).sort({
      created_at: -1,
    }),
    LifestylePlan.findOne({ patient_id: patient._id, doctor_id: doctor._id }).sort({
      created_at: -1,
    }),
  ]);

  const summary = `Patient overview generated with ${uploadedCount} uploaded report(s) and ${generatedCount} generated report(s).`;

  return createGeneratedReportRecord({
    patient,
    doctor,
    createdByUserId: userId,
    reportType: 'patient_overview',
    title: `${patient.full_name} Patient Overview`,
    summary,
    structuredPayload: {
      patient_snapshot: patientSnapshot(patient),
      report_counts: {
        uploaded_reports: uploadedCount,
        generated_reports: generatedCount,
      },
      latest_prescription: latestPrescription
        ? {
            status: latestPrescription.status,
            medication_names: latestPrescription.medications.map((item) => item.medication_name),
            updated_at: latestPrescription.updated_at.toISOString(),
          }
        : null,
      latest_lifestyle_plan: latestPlan
        ? {
            status: latestPlan.status,
            updated_at: latestPlan.updated_at.toISOString(),
            follow_up_note: latestPlan.follow_up_note ?? null,
          }
        : null,
    },
  });
}

export async function listGeneratedReportsForPatient(userId: string) {
  const patient = await requirePatientForUser(userId);
  const items = await Report.find({
    patient_id: patient._id,
    is_sent_to_patient: true,
  }).sort({ created_at: -1 });
  return {
    items: items.map((item) => {
      const mapped = mapGeneratedReport(item);
      return {
        ...mapped,
        structured_payload: sanitizeGeneratedPayloadForPatient(mapped.structured_payload),
      };
    }),
  };
}

export async function listGeneratedReportsForDoctorPatient(userId: string, patientId: string) {
  const { patient } = await requireManagedPatient(userId, patientId);
  const items = await Report.find({
    patient_id: patient._id,
  }).sort({ created_at: -1 });
  return { items: items.map(mapGeneratedReport) };
}

export async function getGeneratedReportById(
  userRole: 'doctor' | 'patient' | 'admin',
  userId: string,
  reportId: string,
) {
  const mapped = mapGeneratedReport(await getAccessibleGeneratedReport(userRole, userId, reportId));
  if (userRole === 'patient') {
    return {
      ...mapped,
      structured_payload: sanitizeGeneratedPayloadForPatient(mapped.structured_payload),
    };
  }
  return mapped;
}

export async function getGeneratedReportFile(
  userRole: 'doctor' | 'patient' | 'admin',
  userId: string,
  reportId: string,
) {
  const report = await getAccessibleGeneratedReport(userRole, userId, reportId);
  if (!report.attachment_path || !fs.existsSync(report.attachment_path)) {
    await ensureGeneratedPdf(report);
  }
  if (!report.attachment_path || !fs.existsSync(report.attachment_path)) {
    throw new ReportModuleError(StatusCodes.NOT_FOUND, 'Generated report file not found');
  }
  return {
    path: report.attachment_path,
    fileName: `${report.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'report'}.pdf`,
    mimeType: 'application/pdf',
  };
}

export async function getPatientReportsOverview(userId: string) {
  const [uploaded, generated] = await Promise.all([
    listUploadedReportsForPatient(userId),
    listGeneratedReportsForPatient(userId),
  ]);
  return {
    uploaded_reports: uploaded.items,
    generated_reports: generated.items,
  };
}

export async function getDoctorPatientReportsOverview(userId: string, patientId: string) {
  const [uploaded, generated] = await Promise.all([
    listUploadedReportsForDoctorPatient(userId, patientId),
    listGeneratedReportsForDoctorPatient(userId, patientId),
  ]);
  return {
    uploaded_reports: uploaded.items,
    generated_reports: generated.items,
  };
}

export async function shareGeneratedReportToPatient(userId: string, reportId: string) {
  const report = await getAccessibleGeneratedReport('doctor', userId, reportId);
  const doctor = await requireDoctorForUser(userId);
  report.is_sent_to_patient = true;
  if (!report.sent_to_patient_at) {
    report.sent_to_patient_at = new Date();
  }
  report.last_sent_at = new Date();
  report.send_count = (report.send_count ?? 0) + 1;
  await report.save();

  await createNotificationForPatientProfile(report.patient_id, {
    type: 'generated_report_shared',
    title: 'New generated report shared',
    message: `${doctor.name} shared "${report.title}" with you.`,
    href: '/reports',
    data: {
      report_id: report.id,
      patient_id: report.patient_id.toString(),
      doctor_id: report.doctor_id?.toString() ?? doctor.id,
      report_type: report.type,
      send_count: report.send_count ?? 1,
    },
  }).catch(() => null);

  return mapGeneratedReport(report);
}
