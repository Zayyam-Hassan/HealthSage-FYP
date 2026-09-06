import { compareWhatIfForDoctor, getWhatIfBaselineForDoctor } from '../../services/whatIfService';
import { Doctor } from '../../models/Doctor';
import { Patient } from '../../models/Patient';
import { callWhatIfBaseline, callWhatIfCompare } from '../../integrations/fastapi/client';

jest.mock('../../models/Doctor', () => ({
  Doctor: {
    findOne: jest.fn(),
  },
}));
jest.mock('../../models/Patient', () => ({
  Patient: {
    findById: jest.fn(),
  },
}));
jest.mock('../../integrations/fastapi/client', () => ({
  callWhatIfBaseline: jest.fn(),
  callWhatIfCompare: jest.fn(),
}));

describe('whatIfService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for unauthorized role', async () => {
    (Patient.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        full_name: 'Patient One',
      }),
    });
    const result = await getWhatIfBaselineForDoctor(
      { sub: 'u1', role: 'patient', email: 'p@a.com' },
      '507f1f77bcf86cd799439011',
    );
    expect(result).toBeNull();
  });

  it('returns baseline for assigned doctor', async () => {
    (Patient.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        full_name: 'Patient One',
        primary_doctor_id: { toString: () => '507f1f77bcf86cd799439012' },
      }),
    });
    (Doctor.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012' }),
    });
    (callWhatIfBaseline as jest.Mock).mockResolvedValue({ baseline: { risk_score: 0.1 } });
    const result = await getWhatIfBaselineForDoctor(
      { sub: '507f1f77bcf86cd799439099', role: 'doctor', email: 'd@a.com' },
      '507f1f77bcf86cd799439011',
    );
    expect(result).toEqual(
      expect.objectContaining({
        patient_name: 'Patient One',
      }),
    );
  });

  it('returns compare response when authorized', async () => {
    (Patient.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        full_name: 'Patient One',
        primary_doctor_id: { toString: () => '507f1f77bcf86cd799439012' },
      }),
    });
    (Doctor.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012' }),
    });
    (callWhatIfCompare as jest.Mock).mockResolvedValue({ scenario: { risk_score: 0.3 } });
    const result = await compareWhatIfForDoctor(
      { sub: '507f1f77bcf86cd799439099', role: 'doctor', email: 'd@a.com' },
      '507f1f77bcf86cd799439011',
      { modifications: { BMI: 24 } },
    );
    expect(result).toEqual(
      expect.objectContaining({
        patient_name: 'Patient One',
      }),
    );
  });
});
