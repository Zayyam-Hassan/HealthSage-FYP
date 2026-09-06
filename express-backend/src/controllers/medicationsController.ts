import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { MedicationCatalog } from '../models/MedicationCatalog';

function mapMedication(doc: any) {
  const id = doc.id;
  return {
    id,
    medication_id: doc.medication_id ?? id,
    name: doc.name,
    brand_name: doc.brand_name,
    description: doc.description,
    side_effects: Array.isArray(doc.side_effects) ? doc.side_effects : [],
    warnings: Array.isArray(doc.warnings) ? doc.warnings : [],
    how_to_use: doc.how_to_use,
    created_at: doc.created_at.toISOString(),
    updated_at: doc.updated_at.toISOString(),
  };
}

export async function listMedications(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page ?? 1) || 1;
  const limit = Number(req.query.limit ?? 20) || 20;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const filter: Record<string, unknown> = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { brand_name: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MedicationCatalog.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    MedicationCatalog.countDocuments(filter),
  ]);

  res.json({
    items: items.map(mapMedication),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}

export async function getMedication(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    // Fall back: allow passing medication_id string that is not ObjectId
    const byMedId = await MedicationCatalog.findOne({ medication_id: id });
    if (!byMedId) {
      res.status(404).json({ message: 'Medication not found' });
      return;
    }
    res.json(mapMedication(byMedId));
    return;
  }

  const med = await MedicationCatalog.findById(id);
  if (!med) {
    res.status(404).json({ message: 'Medication not found' });
    return;
  }
  res.json(mapMedication(med));
}

