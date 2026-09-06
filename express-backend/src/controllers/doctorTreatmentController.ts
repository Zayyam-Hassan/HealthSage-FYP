import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import {
  doctorTreatmentMedicationStatuses,
  doctorTreatmentPlanStatuses,
} from '../models/DoctorTreatmentPlan';
import {
  DoctorTreatmentError,
  completeDoctorTreatmentPlanForDoctor,
  createDoctorTreatmentPlanForPatient,
  discontinueDoctorTreatmentPlanForDoctor,
  getDoctorActiveTreatmentSummaryForDoctor,
  getDoctorTreatmentPlanForDoctor,
  getDoctorTreatmentPlanForPatient,
  getPatientActiveDoctorTreatmentPlan,
  listDoctorTreatmentPlansForPatient,
  listPatientDoctorTreatmentHistory,
  updateDoctorTreatmentPlanForDoctor,
} from '../services/doctorTreatmentService';

const MedicationItemSchema = z.object({
  medication_name: z.string().min(1).max(160),
  dosage: z.string().min(1).max(120),
  frequency: z.string().min(1).max(120),
  route: z.string().min(1).max(120),
  duration: z.string().min(1).max(120),
  timing_instructions: z.string().min(1).max(240),
  special_instructions: z.string().max(400).optional(),
  status: z.enum(doctorTreatmentMedicationStatuses).optional(),
});

const AssessmentSchema = z
  .object({
    diagnosis: z.string().max(240).optional(),
    clinical_impression: z.string().max(1200).optional(),
    risk_assessment: z.string().max(240).optional(),
    treatment_goal: z.string().max(600).optional(),
    follow_up_note: z.string().max(1000).optional(),
    rationale: z.string().max(1200).optional(),
  })
  .optional();

const LifestylePlanSchema = z
  .object({
    diet_plan: z.string().max(1200).optional(),
    exercise_plan: z.string().max(1200).optional(),
    sleep_guidance: z.string().max(1200).optional(),
    stress_guidance: z.string().max(1200).optional(),
    monitoring_guidance: z.string().max(1200).optional(),
    general_lifestyle_note: z.string().max(1000).optional(),
  })
  .optional();

const DoctorTreatmentPlanSchema = z.object({
  assessment: AssessmentSchema,
  medications: z.array(MedicationItemSchema).optional(),
  lifestyle_plan: LifestylePlanSchema,
  doctor_note: z.string().max(1200).optional(),
});

function handleError(res: Response, error: unknown): void {
  if (error instanceof DoctorTreatmentError) {
    res.status(error.status).json({
      message: error.message,
      detail: error.detail,
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid doctor treatment payload',
      detail: error.flatten(),
    });
    return;
  }

  throw error;
}

export async function createDoctorTreatmentPlan(req: Request, res: Response): Promise<void> {
  try {
    const payload = DoctorTreatmentPlanSchema.parse(req.body);
    const item = await createDoctorTreatmentPlanForPatient(
      req.user!.sub,
      req.params.patientId,
      payload,
    );
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function listDoctorTreatmentPlans(req: Request, res: Response): Promise<void> {
  try {
    res.json(await listDoctorTreatmentPlansForPatient(req.user!.sub, req.params.patientId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorTreatmentPlanById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getDoctorTreatmentPlanForDoctor(req.user!.sub, req.params.treatmentPlanId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateDoctorTreatmentPlan(req: Request, res: Response): Promise<void> {
  try {
    const payload = DoctorTreatmentPlanSchema.parse(req.body);
    res.json(
      await updateDoctorTreatmentPlanForDoctor(
        req.user!.sub,
        req.params.treatmentPlanId,
        payload,
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function discontinueDoctorTreatmentPlan(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(
      await discontinueDoctorTreatmentPlanForDoctor(
        req.user!.sub,
        req.params.treatmentPlanId,
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function completeDoctorTreatmentPlan(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(
      await completeDoctorTreatmentPlanForDoctor(
        req.user!.sub,
        req.params.treatmentPlanId,
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorActiveTreatmentSummary(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(
      await getDoctorActiveTreatmentSummaryForDoctor(req.user!.sub, req.params.patientId),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientActiveTreatmentPlan(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getPatientActiveDoctorTreatmentPlan(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientTreatmentHistory(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await listPatientDoctorTreatmentHistory(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientTreatmentPlanById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getDoctorTreatmentPlanForPatient(req.user!.sub, req.params.treatmentPlanId));
  } catch (error) {
    handleError(res, error);
  }
}

export { doctorTreatmentPlanStatuses };
