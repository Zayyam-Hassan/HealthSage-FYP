import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface MedicationCatalogDocument extends Document {
  medication_id?: string;
  name: string;
  brand_name?: string;
  description?: string;
  side_effects: string[];
  warnings: string[];
  how_to_use?: string;
  created_at: Date;
  updated_at: Date;
}

const MedicationCatalogSchema = new Schema<MedicationCatalogDocument>(
  {
    medication_id: { type: String, index: true },
    name: { type: String, required: true },
    brand_name: { type: String },
    description: { type: String },
    side_effects: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    how_to_use: { type: String },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'medications',
  },
);

MedicationCatalogSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export const MedicationCatalog: Model<MedicationCatalogDocument> =
  mongoose.models.MedicationCatalog ||
  mongoose.model<MedicationCatalogDocument>('MedicationCatalog', MedicationCatalogSchema);

