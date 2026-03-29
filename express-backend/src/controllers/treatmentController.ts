import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { lifestylePlanStatuses } from '../models/LifestylePlan';
import { prescriptionMedicationStatuses } from '../models/Prescription';
import {
  TreatmentError,
  createLifestylePlanForDoctorPatient,
  createPrescriptionForDoctorPatient,
  discontinueLifestylePlanForDoctor,
  discontinuePrescriptionForDoctor,
  getLifestylePlanForDoctor,
  getPatientTreatmentOverview,
  getPrescriptionForDoctor,
  listLifestylePlansForDoctorPatient,
  listPatientActiveLifestylePlans,
  listPatientActivePrescriptions,
  listPatientLifestylePlans,
  listPatientPrescriptions,
  listPrescriptionsForDoctorPatient,
  updateLifestylePlanForDoctor,
  updatePrescriptionForDoctor,
} from '../services/treatmentService';

const MedicationItemSchema = z.object({
  medication_name: z.string().min(1).max(160),
  dosage: z.string().min(1).max(120),
  frequency: z.string().min(1).max(120),
  route: z.string().min(1).max(120),
  duration: z.string().min(1).max(120),
  timing_instructions: z.string().min(1).max(240),
  special_instructions: z.string().max(400).optional(),
  status: z.enum(prescriptionMedicationStatuses).optional(),
});

const PrescriptionSchema = z.object({
  diagnosis_context: z.string().max(400).optional(),
  general_note: z.string().max(1000).optional(),
  medications: z.array(MedicationItemSchema).min(1),
});

const LifestylePlanSchema = z.object({
  diet_plan: z.string().max(1200).optional(),
  exercise_plan: z.string().max(1200).optional(),
  sleep_guidance: z.string().max(1200).optional(),
  stress_guidance: z.string().max(1200).optional(),
  monitoring_guidance: z.string().max(1200).optional(),
  follow_up_note: z.string().max(1000).optional(),
  general_note: z.string().max(1000).optional(),
});

function handleError(res: Response, error: unknown): void {
  if (error instanceof TreatmentError) {
    res.status(error.status).json({
      message: error.message,
      detail: error.detail,
    });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
      message: 'Invalid treatment payload',
      detail: error.flatten(),
    });
    return;
  }

  throw error;
}

export async function createDoctorPrescription(req: Request, res: Response): Promise<void> {
  try {
    const payload = PrescriptionSchema.parse(req.body);
    const item = await createPrescriptionForDoctorPatient(
      req.user!.sub,
      req.params.patientId,
      payload,
    );
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorPatientPrescriptions(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(
      await listPrescriptionsForDoctorPatient(req.user!.sub, req.params.patientId),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorPrescriptionById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getPrescriptionForDoctor(req.user!.sub, req.params.prescriptionId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateDoctorPrescription(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = PrescriptionSchema.parse(req.body);
    res.json(
      await updatePrescriptionForDoctor(
        req.user!.sub,
        req.params.prescriptionId,
        payload,
      ),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function discontinueDoctorPrescription(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(
      await discontinuePrescriptionForDoctor(req.user!.sub, req.params.prescriptionId),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function createDoctorLifestylePlan(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = LifestylePlanSchema.parse(req.body);
    const item = await createLifestylePlanForDoctorPatient(
      req.user!.sub,
      req.params.patientId,
      payload,
    );
    res.status(StatusCodes.CREATED).json(item);
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorPatientLifestylePlans(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(
      await listLifestylePlansForDoctorPatient(req.user!.sub, req.params.patientId),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function getDoctorLifestylePlanById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getLifestylePlanForDoctor(req.user!.sub, req.params.planId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateDoctorLifestylePlan(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = LifestylePlanSchema.parse(req.body);
    res.json(
      await updateLifestylePlanForDoctor(req.user!.sub, req.params.planId, payload),
    );
  } catch (error) {
    handleError(res, error);
  }
}

export async function discontinueDoctorLifestylePlan(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await discontinueLifestylePlanForDoctor(req.user!.sub, req.params.planId));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientActivePrescriptions(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await listPatientActivePrescriptions(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientPrescriptions(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await listPatientPrescriptions(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientActiveLifestylePlans(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await listPatientActiveLifestylePlans(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientLifestylePlans(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await listPatientLifestylePlans(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}

export async function getPatientTreatmentOverviewSummary(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await getPatientTreatmentOverview(req.user!.sub));
  } catch (error) {
    handleError(res, error);
  }
}
