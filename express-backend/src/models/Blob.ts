import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface BlobDocument extends Document {
  storage_backend: string;
  storage_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by?: mongoose.Types.ObjectId;
  created_at: Date;
}

const BlobSchema = new Schema<BlobDocument>(
  {
    storage_backend: { type: String, required: true },
    storage_key: { type: String, required: true },
    filename: { type: String, required: true },
    content_type: { type: String, required: true },
    size_bytes: { type: Number, required: true },
    uploaded_by: { type: Schema.Types.ObjectId, ref: 'User' },
    created_at: { type: Date, default: () => new Date() },
  },
  {
    collection: 'blobs',
  },
);

export const BlobModel: Model<BlobDocument> =
  mongoose.models.Blob || mongoose.model<BlobDocument>('Blob', BlobSchema);

