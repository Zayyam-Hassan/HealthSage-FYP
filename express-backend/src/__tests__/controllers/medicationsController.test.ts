import type { Request, Response } from 'express';
import { getMedication, listMedications } from '../../controllers/medicationsController';
import { MedicationCatalog } from '../../models/MedicationCatalog';

jest.mock('../../models/MedicationCatalog', () => ({
  MedicationCatalog: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

function buildRes() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

describe('medicationsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists medications with pagination metadata', async () => {
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        {
          id: 'm1',
          medication_id: 'med-1',
          name: 'Metformin',
          brand_name: 'Glucophage',
          description: 'desc',
          side_effects: [],
          warnings: [],
          how_to_use: 'daily',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]),
    };
    (MedicationCatalog.find as jest.Mock).mockReturnValue(mockChain);
    (MedicationCatalog.countDocuments as jest.Mock).mockResolvedValue(1);
    const req = { query: { page: '1', limit: '20' } } as unknown as Request;
    const { res, json } = buildRes();
    await listMedications(req, res);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        page: 1,
        limit: 20,
      }),
    );
  });

  it('returns medication by non-object medication_id fallback', async () => {
    (MedicationCatalog.findOne as jest.Mock).mockResolvedValue({
      id: 'm1',
      medication_id: 'med-custom',
      name: 'Metformin',
      brand_name: 'Glucophage',
      description: 'desc',
      side_effects: [],
      warnings: [],
      how_to_use: 'daily',
      created_at: new Date(),
      updated_at: new Date(),
    });
    const req = { params: { id: 'med-custom' } } as unknown as Request;
    const { res, json } = buildRes();
    await getMedication(req, res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ medication_id: 'med-custom' }));
  });

  it('returns 404 when objectId medication is not found', async () => {
    (MedicationCatalog.findById as jest.Mock).mockResolvedValue(null);
    const req = { params: { id: '507f1f77bcf86cd799439011' } } as unknown as Request;
    const { res, status, json } = buildRes();
    await getMedication(req, res);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: 'Medication not found' });
  });
});
