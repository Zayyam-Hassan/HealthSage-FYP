import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { BlobModel } from '../models/Blob';

const PDF_MIME_TYPE = 'application/pdf';
const MONGO_ATTACHMENT_PREFIX = 'mongo:';

function extractMongoAttachmentId(attachmentPath?: string | null) {
  if (!attachmentPath?.startsWith(MONGO_ATTACHMENT_PREFIX)) {
    return null;
  }

  const blobId = attachmentPath.slice(MONGO_ATTACHMENT_PREFIX.length).trim();
  return blobId || null;
}

async function findBlobForAttachmentPath(attachmentPath?: string | null) {
  const blobId = extractMongoAttachmentId(attachmentPath);
  if (!blobId) {
    return null;
  }

  if (mongoose.isValidObjectId(blobId)) {
    const blob = await BlobModel.findById(blobId);
    if (blob) {
      return blob;
    }
  }

  return BlobModel.findOne({ storage_key: attachmentPath });
}

export function buildPdfAttachmentFileName(title: string) {
  const safeName = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `${safeName || 'report'}.pdf`;
}

export async function storePdfAttachment(args: {
  title: string;
  buffer: Buffer;
  uploadedByUserId?: mongoose.Types.ObjectId | null;
}) {
  const blob = new BlobModel({
    storage_backend: 'mongo',
    storage_key: 'pending',
    filename: buildPdfAttachmentFileName(args.title),
    content_type: PDF_MIME_TYPE,
    size_bytes: args.buffer.length,
    data_buffer: args.buffer,
    uploaded_by: args.uploadedByUserId ?? undefined,
  });

  blob.storage_key = `${MONGO_ATTACHMENT_PREFIX}${blob.id}`;
  await blob.save();

  return {
    attachmentPath: blob.storage_key,
    fileName: blob.filename,
    mimeType: blob.content_type,
    size: blob.size_bytes,
  };
}

export async function readPdfAttachment(attachmentPath?: string | null) {
  if (!attachmentPath) {
    return null;
  }

  const blob = await findBlobForAttachmentPath(attachmentPath);
  if (blob?.data_buffer?.length) {
    return {
      buffer: Buffer.from(blob.data_buffer),
      fileName: blob.filename,
      mimeType: blob.content_type || PDF_MIME_TYPE,
    };
  }

  if (!fs.existsSync(attachmentPath)) {
    return null;
  }

  return {
    buffer: await fs.promises.readFile(attachmentPath),
    fileName: path.basename(attachmentPath),
    mimeType: PDF_MIME_TYPE,
  };
}

export async function deletePdfAttachment(attachmentPath?: string | null) {
  if (!attachmentPath) {
    return;
  }

  const blob = await findBlobForAttachmentPath(attachmentPath);
  if (blob) {
    await blob.deleteOne();
    return;
  }

  if (fs.existsSync(attachmentPath)) {
    await fs.promises.unlink(attachmentPath).catch(() => null);
  }
}
