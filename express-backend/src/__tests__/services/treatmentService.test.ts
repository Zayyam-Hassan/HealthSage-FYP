import { StatusCodes } from 'http-status-codes';
import {
  TreatmentError,
  createPrescriptionForDoctorPatient,
} from '../../services/treatmentService';
import { Doctor } from '../../models/Doctor';
import { Patient } from '../../models/Patient';

jest.mock('../../models/Doctor', () => ({
  Doctor: { findOne: jest.fn(), find: jest.fn() },
}));
jest.mock('../../models/Patient', () => ({
  Patient: { findById: jest.fn(), findOne: jest.fn() },
}));
jest.mock('../../models/Prescription', () => ({
  Prescription: { updateMany: jest.fn(), create: jest.fn(), findById: jest.fn(), find: jest.fn() },
}));
jest.mock('../../models/LifestylePlan', () => ({
  LifestylePlan: { updateMany: jest.fn(), create: jest.fn(), findById: jest.fn(), find: jest.fn() },
}));

describe('treatmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when patientId is invalid ObjectId', async () => {
    (Doctor.findOne as jest.Mock).mockResolvedValue({ id: 'doctor1', _id: 'doctor1' });

    await expect(
      createPrescriptionForDoctorPatient('507f1f77bcf86cd799439011', 'bad-id', {
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
      }),
    ).rejects.toMatchObject({
      status: StatusCodes.NOT_FOUND,
      message: 'Patient not found',
    });
  });

  it('throws validation error when medications are empty', async () => {
    (Doctor.findOne as jest.Mock).mockResolvedValue({
      id: '507f1f77bcf86cd799439012',
      _id: '507f1f77bcf86cd799439012',
    });
    (Patient.findById as jest.Mock).mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      id: '507f1f77bcf86cd799439011',
      primary_doctor_id: { toString: () => '507f1f77bcf86cd799439012' },
      full_name: 'Patient One',
    });

    await expect(
      createPrescriptionForDoctorPatient(
        '507f1f77bcf86cd799439099',
        '507f1f77bcf86cd799439011',
        { medications: [] },
      ),
    ).rejects.toBeInstanceOf(TreatmentError);
  });
});
