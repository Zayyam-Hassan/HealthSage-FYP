import { StatusCodes } from 'http-status-codes';
import type { Request, Response } from 'express';
import {
  TreatmentError,
  createPrescriptionForDoctorPatient,
  createLifestylePlanForDoctorPatient,
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
} from '../../services/treatmentService';
import {
  createDoctorLifestylePlan,
  createDoctorPrescription,
  discontinueDoctorLifestylePlan,
  discontinueDoctorPrescription,
  getDoctorLifestylePlanById,
  getDoctorPatientLifestylePlans,
  getDoctorPatientPrescriptions,
  getDoctorPrescriptionById,
  getPatientActiveLifestylePlans,
  getPatientActivePrescriptions,
  getPatientLifestylePlans,
  getPatientPrescriptions,
  getPatientTreatmentOverviewSummary,
  updateDoctorLifestylePlan,
  updateDoctorPrescription,
} from '../../controllers/treatmentController';

jest.mock('../../services/treatmentService', () => {
  class MockTreatmentError extends Error {
    status: number;
    detail?: unknown;
    constructor(status: number, message: string, detail?: unknown) {
      super(message);
      this.status = status;
      this.detail = detail;
    }
  }
  return {
    TreatmentError: MockTreatmentError,
    createPrescriptionForDoctorPatient: jest.fn(),
    createLifestylePlanForDoctorPatient: jest.fn(),
    discontinueLifestylePlanForDoctor: jest.fn(),
    discontinuePrescriptionForDoctor: jest.fn(),
    getLifestylePlanForDoctor: jest.fn(),
    getPatientTreatmentOverview: jest.fn(),
    getPrescriptionForDoctor: jest.fn(),
    listLifestylePlansForDoctorPatient: jest.fn(),
    listPatientActiveLifestylePlans: jest.fn(),
    listPatientActivePrescriptions: jest.fn(),
    listPatientLifestylePlans: jest.fn(),
    listPatientPrescriptions: jest.fn(),
    listPrescriptionsForDoctorPatient: jest.fn(),
    updateLifestylePlanForDoctor: jest.fn(),
    updatePrescriptionForDoctor: jest.fn(),
  };
});

jest.mock('../../services/notificationsService', () => ({
  createNotificationForPatientProfile: jest.fn().mockResolvedValue(undefined),
}));

function buildRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

describe('treatmentController.createDoctorPrescription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 422 for invalid payload', async () => {
    const req = {
      user: { sub: 'doc1' },
      params: { patientId: 'pat1' },
      body: { medications: [] },
    } as unknown as Request;
    const { res, status, json } = buildRes();

    await createDoctorPrescription(req, res);

    expect(status).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid treatment payload' }),
    );
  });

  it('maps TreatmentError to controller response', async () => {
    (createPrescriptionForDoctorPatient as jest.Mock).mockRejectedValue(
      new TreatmentError(StatusCodes.FORBIDDEN, 'Forbidden', { reason: 'not-assigned' }),
    );
    const req = {
      user: { sub: 'doc1' },
      params: { patientId: 'pat1' },
      body: {
        medications: [
          {
            medication_name: 'Metformin',
            dosage: '500mg',
            frequency: 'daily',
            route: 'oral',
            duration: '30 days',
            timing_instructions: 'after meal',
          },
        ],
      },
    } as unknown as Request;
    const { res, status, json } = buildRes();

    await createDoctorPrescription(req, res);

    expect(status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({
      message: 'Forbidden',
      detail: { reason: 'not-assigned' },
    });
  });
});

describe('treatmentController additional methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists doctor prescriptions', async () => {
    (listPrescriptionsForDoctorPatient as jest.Mock).mockResolvedValue({ items: [{ id: 'rx1' }] });
    const req = { user: { sub: 'doc1' }, params: { patientId: 'pat1' } } as unknown as Request;
    const { res, json } = buildRes();
    await getDoctorPatientPrescriptions(req, res);
    expect(json).toHaveBeenCalledWith({ items: [{ id: 'rx1' }] });
  });

  it('gets doctor prescription by id', async () => {
    (getPrescriptionForDoctor as jest.Mock).mockResolvedValue({ id: 'rx1' });
    const req = { user: { sub: 'doc1' }, params: { prescriptionId: 'rx1' } } as unknown as Request;
    const { res, json } = buildRes();
    await getDoctorPrescriptionById(req, res);
    expect(json).toHaveBeenCalledWith({ id: 'rx1' });
  });

  it('updates doctor prescription', async () => {
    (updatePrescriptionForDoctor as jest.Mock).mockResolvedValue({ id: 'rx1', patient_id: 'p1', medications: [] });
    const req = { user: { sub: 'doc1' }, params: { prescriptionId: 'rx1' }, body: { medications: [{ medication_name: 'A', dosage: '1', frequency: '1', route: 'oral', duration: '10d', timing_instructions: 'night' }] } } as unknown as Request;
    const { res, json } = buildRes();
    await updateDoctorPrescription(req, res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: 'rx1' }));
  });

  it('discontinues doctor prescription', async () => {
    (discontinuePrescriptionForDoctor as jest.Mock).mockResolvedValue({ id: 'rx1', patient_id: 'p1' });
    const req = { user: { sub: 'doc1' }, params: { prescriptionId: 'rx1' } } as unknown as Request;
    const { res, json } = buildRes();
    await discontinueDoctorPrescription(req, res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ id: 'rx1' }));
  });

  it('creates doctor lifestyle plan', async () => {
    (createLifestylePlanForDoctorPatient as jest.Mock).mockResolvedValue({ id: 'lp1', patient_id: 'p1' });
    const req = { user: { sub: 'doc1' }, params: { patientId: 'p1' }, body: { diet_plan: 'low sugar' } } as unknown as Request;
    const { res, status } = buildRes();
    await createDoctorLifestylePlan(req, res);
    expect(status).toHaveBeenCalledWith(StatusCodes.CREATED);
  });

  it('lists doctor lifestyle plans', async () => {
    (listLifestylePlansForDoctorPatient as jest.Mock).mockResolvedValue({ items: [{ id: 'lp1' }] });
    const req = { user: { sub: 'doc1' }, params: { patientId: 'p1' } } as unknown as Request;
    const { res, json } = buildRes();
    await getDoctorPatientLifestylePlans(req, res);
    expect(json).toHaveBeenCalledWith({ items: [{ id: 'lp1' }] });
  });

  it('gets doctor lifestyle plan by id', async () => {
    (getLifestylePlanForDoctor as jest.Mock).mockResolvedValue({ id: 'lp1' });
    const req = { user: { sub: 'doc1' }, params: { planId: 'lp1' } } as unknown as Request;
    const { res, json } = buildRes();
    await getDoctorLifestylePlanById(req, res);
    expect(json).toHaveBeenCalledWith({ id: 'lp1' });
  });

  it('updates doctor lifestyle plan', async () => {
    (updateLifestylePlanForDoctor as jest.Mock).mockResolvedValue({ id: 'lp1' });
    const req = { user: { sub: 'doc1' }, params: { planId: 'lp1' }, body: { diet_plan: 'new plan' } } as unknown as Request;
    const { res, json } = buildRes();
    await updateDoctorLifestylePlan(req, res);
    expect(json).toHaveBeenCalledWith({ id: 'lp1' });
  });

  it('discontinues doctor lifestyle plan', async () => {
    (discontinueLifestylePlanForDoctor as jest.Mock).mockResolvedValue({ id: 'lp1' });
    const req = { user: { sub: 'doc1' }, params: { planId: 'lp1' } } as unknown as Request;
    const { res, json } = buildRes();
    await discontinueDoctorLifestylePlan(req, res);
    expect(json).toHaveBeenCalledWith({ id: 'lp1' });
  });

  it('returns patient-focused treatment endpoints', async () => {
    (listPatientActivePrescriptions as jest.Mock).mockResolvedValue({ items: [] });
    (listPatientPrescriptions as jest.Mock).mockResolvedValue({ items: [] });
    (listPatientActiveLifestylePlans as jest.Mock).mockResolvedValue({ items: [] });
    (listPatientLifestylePlans as jest.Mock).mockResolvedValue({ items: [] });
    (getPatientTreatmentOverview as jest.Mock).mockResolvedValue({ active_prescriptions: [] });
    const req = { user: { sub: 'pat1' } } as unknown as Request;
    const a = buildRes();
    const b = buildRes();
    const c = buildRes();
    const d = buildRes();
    const e = buildRes();
    await getPatientActivePrescriptions(req, a.res);
    await getPatientPrescriptions(req, b.res);
    await getPatientActiveLifestylePlans(req, c.res);
    await getPatientLifestylePlans(req, d.res);
    await getPatientTreatmentOverviewSummary(req, e.res);
    expect(a.json).toHaveBeenCalledWith({ items: [] });
    expect(e.json).toHaveBeenCalledWith({ active_prescriptions: [] });
  });
});
