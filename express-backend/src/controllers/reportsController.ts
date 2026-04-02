import fs from 'fs';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { Doctor } from '../models/Doctor';
import { Patient } from '../models/Patient';
import { Report } from '../models/Report';
import { createNotificationForPatientProfile } from '../services/notificationsService';
import { buildPatientCarePdfSections } from '../utils/patientCareReport';
import { writeReportPdf } from '../utils/reportPdf';

const REPORT_SEND_COOLDOWN_MS = 5 * 60 * 1000;

function buildDownloadUrl(reportId: string) {
  return `/mongo/reports/${reportId}/file`;
}

function mapReport(doc: any) {
  const id = doc.id;
  const patientId =
    typeof doc.patient_id === 'string'
      ? doc.patient_id
      : (doc.patient_id as mongoose.Types.ObjectId)?.toString();
  return {
    id,
    patient_id: patientId,
    title: doc.title,
    type: doc.type,
    content: doc.content ?? {},
    generated_at: doc.generated_at.toISOString(),
    generated_by: doc.generated_by,
    attachment_url: doc.attachment_path ? buildDownloadUrl(id) : doc.attachment_url,
    is_sent_to_patient: doc.is_sent_to_patient ?? false,
    sent_to_patient_at: doc.sent_to_patient_at?.toISOString() ?? null,
    last_sent_at: doc.last_sent_at?.toISOString() ?? null,
    send_count: doc.send_count ?? 0,
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  };
}

async function ensurePdfForReport(report: any) {
  const filePath = await writeReportPdf(
    report.id,
    report.title,
    buildPatientCarePdfSections(report.content ?? {}),
  );

  report.attachment_path = filePath;
  report.attachment_url = buildDownloadUrl(report.id);
  await report.save();
}

async function getDoctorScope(userId: string) {
  const doctor = await Doctor.findOne({
    user_id: new mongoose.Types.ObjectId(userId),
  });
  if (!doctor) {
    return { _id: null };
  }

  const patients = await Patient.find({ primary_doctor_id: doctor._id }).select('_id');
  return {
    patient_id: { $in: patients.map((patient) => patient._id) },
  };
}

async function getScopedReportFilter(req: Request) {
  if (!req.user) return {};
  if (req.user.role === 'doctor') {
    return getDoctorScope(req.user.sub);
  }
  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({
      user_id: new mongoose.Types.ObjectId(req.user.sub),
    });
    if (!patient) return { _id: null };
    return { patient_id: patient._id, is_sent_to_patient: true };
  }
  return {};
}

async function canAccessReportByPatientId(
  req: Request,
  patientId: mongoose.Types.ObjectId,
) {
  const scopedFilter = await getScopedReportFilter(req);
  if (!scopedFilter.patient_id) {
    return true;
  }

  const scopedPatient = scopedFilter.patient_id as
    | mongoose.Types.ObjectId
    | { $in?: mongoose.Types.ObjectId[] };

  if (
    typeof (scopedPatient as any)?.toString === 'function' &&
    !(scopedPatient as any)?.$in
  ) {
    return scopedPatient.toString() === patientId.toString();
  }

  if (Array.isArray((scopedPatient as any)?.$in)) {
    return (scopedPatient as any).$in.some(
      (allowedPatientId: mongoose.Types.ObjectId) =>
        allowedPatientId.toString() === patientId.toString(),
    );
  }

  return false;
}

async function getAccessibleReport(req: Request, id: string) {
  const report = await Report.findById(id);
  if (!report) {
    return null;
  }

  const allowed = await canAccessReportByPatientId(req, report.patient_id);
  if (!allowed) {
    return null;
  }

  if (req.user?.role === 'patient' && !report.is_sent_to_patient) {
    return null;
  }

  return report;
}

export async function createReport(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    patient_id: string;
    title: string;
    type: string;
    content: Record<string, unknown>;
    attachment_url?: string;
  };

  if (!body.patient_id || !body.title || !body.type || !body.content) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: 'Missing required fields' });
    return;
  }

  if (!mongoose.isValidObjectId(body.patient_id)) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: 'Invalid patient_id' });
    return;
  }

  const patientId = new mongoose.Types.ObjectId(body.patient_id);
  if (!(await canAccessReportByPatientId(req, patientId))) {
    res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
    return;
  }

  const report = await Report.create({
    patient_id: patientId,
    created_by_user_id: req.user ? new mongoose.Types.ObjectId(req.user.sub) : null,
    title: body.title,
    type: body.type,
    content: body.content,
    attachment_url: body.attachment_url,
  });

  await ensurePdfForReport(report);

  res.status(StatusCodes.CREATED).json(mapReport(report));
}

export async function listReports(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1) || 1;
  const limit = Number(req.query.limit ?? 20) || 20;
  const patient_id = typeof req.query.patient_id === 'string' ? req.query.patient_id : undefined;
  const typeFilter = typeof req.query.type === 'string' ? req.query.type : undefined;

  const filter: Record<string, unknown> = {
    ...(await getScopedReportFilter(req)),
  };
  if (patient_id && mongoose.isValidObjectId(patient_id)) {
    filter.patient_id = new mongoose.Types.ObjectId(patient_id);
  }
  if (typeFilter) {
    filter.type = typeFilter;
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Report.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    Report.countDocuments(filter),
  ]);

  res.json({
    items: items.map(mapReport),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

export async function getReport(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  const report = await getAccessibleReport(req, id);
  if (!report) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  res.json(mapReport(report));
}

export async function updateReport(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  const report = await getAccessibleReport(req, id);
  if (!report) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  const body = req.body as Partial<{
    title: string;
    type: string;
    content: Record<string, unknown>;
  }>;

  if (body.title !== undefined) report.title = body.title;
  if (body.type !== undefined) report.type = body.type;
  if (body.content !== undefined) report.content = body.content;

  await report.save();
  await ensurePdfForReport(report);

  res.json(mapReport(report));
}

export async function sendReportToPatient(req: Request, res: Response): Promise<void> {
  if (!req.user || req.user.role !== 'doctor') {
    res.status(StatusCodes.FORBIDDEN).json({ message: 'Only doctors can send reports' });
    return;
  }

  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  const report = await getAccessibleReport(req, id);
  if (!report) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  if (
    report.last_sent_at &&
    Date.now() - report.last_sent_at.getTime() < REPORT_SEND_COOLDOWN_MS
  ) {
    res.status(StatusCodes.TOO_MANY_REQUESTS).json({
      message: 'Please wait before sending this report again',
    });
    return;
  }

  if (!report.attachment_path || !fs.existsSync(report.attachment_path)) {
    await ensurePdfForReport(report);
  }

  report.is_sent_to_patient = true;
  if (!report.sent_to_patient_at) {
    report.sent_to_patient_at = new Date();
  }
  report.last_sent_at = new Date();
  report.send_count = (report.send_count ?? 0) + 1;
  await report.save();
  await createNotificationForPatientProfile(report.patient_id, {
    type: 'generated_report_shared',
    title: 'New shared report',
    message: `${report.title} is now available in your reports.`,
    href: '/reports',
    data: {
      patient_id: report.patient_id.toString(),
      report_id: report.id,
    },
  }).catch(() => null);

  res.json(mapReport(report));
}

export async function downloadReportFile(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  const report = await getAccessibleReport(req, id);
  if (!report || !report.attachment_path || !fs.existsSync(report.attachment_path)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report file not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${report.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'report'}.pdf"`,
  );
  res.sendFile(report.attachment_path);
}

export async function deleteReport(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  const report = await getAccessibleReport(req, id);
  if (!report) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Report not found' });
    return;
  }

  if (report.attachment_path && fs.existsSync(report.attachment_path)) {
    await fs.promises.unlink(report.attachment_path).catch(() => null);
  }

  await Report.findByIdAndDelete(id);
  res.status(StatusCodes.NO_CONTENT).send();
}
