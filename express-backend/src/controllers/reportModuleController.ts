import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { uploadedReportCategories } from '../models/UploadedReport';
import {
  ReportModuleError,
  deleteUploadedReportById,
  generatePatientOverviewReport,
  generateRiskSummaryReport,
  generateTreatmentSummaryReport,
  getDoctorPatientReportsOverview,
  getGeneratedReportById,
  getGeneratedReportFile,
  getPatientReportsOverview,
  getUploadedReportBlob,
  getUploadedReportById,
  listGeneratedReportsForDoctorPatient,
  listGeneratedReportsForPatient,
  listUploadedReportsForDoctorPatient,
  listUploadedReportsForPatient,
  uploadReportForDoctor,
  uploadReportForPatient,
} from '../services/reportModuleService';

const UploadReportSchema = z.object({
  title: z.string().min(1).max(180),
  category: z.enum(uploadedReportCategories),
  description: z.string().max(1000).optional(),
  file_name: z.string().min(1).max(240),
  mime_type: z.string().min(1).max(120),
  file_data_base64: z.string().min(1),
});

function handleError(res: Response, error: unknown): void {
  if (error instanceof ReportModuleError) {
    res.status(error.status).json({
      message: error.message,
      detail: error.detail,
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid report payload',
      detail: error.flatten(),
    });
    return;
  }

  throw error;
}

export async function createPatientUploadedReport(req: Request, res: Response): Promise<void> {
  try {
    const payload = UploadReportSchema.parse(req.body);
    const item = await uploadReportForPatient(req.user!.sub, payload);
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createDoctorUploadedReport(req: Request, res: Response): Promise<void> {
  try {
    const payload = UploadReportSchema.parse(req.body);
    const item = await uploadReportForDoctor(req.user!.sub, req.params.patientId, payload);
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientUploadedReports(req: Request, res: Response): Promise<void> {
  try {
    res.json(await listUploadedReportsForPatient(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorPatientUploadedReports(req: Request, res: Response): Promise<void> {
  try {
    res.json(await listUploadedReportsForDoctorPatient(req.user!.sub, req.params.patientId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getUploadedReport(req: Request, res: Response): Promise<void> {
  try {
    res.json(await getUploadedReportById(req.user!.role, req.user!.sub, req.params.reportId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function downloadUploadedReport(req: Request, res: Response): Promise<void> {
  try {
    const file = await getUploadedReportBlob(req.user!.role, req.user!.sub, req.params.reportId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.sendFile(file.path);
  } catch (error) {
    handleError(res, error);
  }
}

export async function removeUploadedReport(req: Request, res: Response): Promise<void> {
  try {
    await deleteUploadedReportById(req.user!.role, req.user!.sub, req.params.reportId);
    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    handleError(res, error);
  }
}

export async function createRiskSummaryGeneratedReport(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const item = await generateRiskSummaryReport(req.user!.sub, req.params.patientId);
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createTreatmentSummaryGeneratedReport(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const item = await generateTreatmentSummaryReport(req.user!.sub, req.params.patientId);
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function createOverviewGeneratedReport(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const item = await generatePatientOverviewReport(req.user!.sub, req.params.patientId);
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientGeneratedReports(req: Request, res: Response): Promise<void> {
  try {
    res.json(await listGeneratedReportsForPatient(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorPatientGeneratedReports(req: Request, res: Response): Promise<void> {
  try {
    res.json(await listGeneratedReportsForDoctorPatient(req.user!.sub, req.params.patientId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getGeneratedReport(req: Request, res: Response): Promise<void> {
  try {
    res.json(await getGeneratedReportById(req.user!.role, req.user!.sub, req.params.reportId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function downloadGeneratedReport(req: Request, res: Response): Promise<void> {
  try {
    const file = await getGeneratedReportFile(req.user!.role, req.user!.sub, req.params.reportId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.sendFile(file.path);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientReportsSummary(req: Request, res: Response): Promise<void> {
  try {
    res.json(await getPatientReportsOverview(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorPatientReportsSummary(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getDoctorPatientReportsOverview(req.user!.sub, req.params.patientId));
  } catch (error) {
    handleError(res, error);
  }
}
