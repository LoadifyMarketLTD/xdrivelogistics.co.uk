import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isDriverContext } from '../mobile/_lib';
import { requireWebDriver } from '../_lib/webDriver';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  'Driving Licence',
  'Insurance',
  'DBS Certificate',
  'CPC Card',
  'Tacho Card',
  'Medical Certificate',
  'Other',
]);

const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function cleanText(value: FormDataEntryValue | null, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validIsoDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasExpectedMagicBytes(bytes: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document upload is temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'The document upload request is invalid.' });
  }

  const docType = cleanText(form.get('docType'), 100);
  const issuedDate = cleanText(form.get('issuedDate'), 10);
  const expiryDate = cleanText(form.get('expiryDate'), 10);
  const file = form.get('file');

  if (!ALLOWED_DOCUMENT_TYPES.has(docType)) {
    return json(400, { error: 'Choose a supported document type.' });
  }
  if (!validIsoDate(issuedDate) || !validIsoDate(expiryDate)) {
    return json(400, { error: 'Issue and expiry dates must be valid dates.' });
  }
  if (issuedDate && expiryDate && expiryDate < issuedDate) {
    return json(400, { error: 'Expiry date cannot be before the issue date.' });
  }
  if (!(file instanceof File)) {
    return json(400, { error: 'Select a PDF or image before submitting.' });
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
    return json(413, { error: 'File must be 10 MB or smaller.' });
  }

  const mimeType = String(file.type || '').toLowerCase();
  const extension = MIME_EXTENSION[mimeType];
  if (!extension) {
    return json(415, { error: 'Use a PDF, JPG, PNG or WEBP document.' });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedMagicBytes(bytes, mimeType)) {
    return json(415, { error: 'Document content does not match its declared file type.' });
  }

  // Keep the existing driver-docs tenant path contract: segment 1 is a UUID
  // tenant anchor and segment 2 is always the authenticated Driver id. This
  // preserves the existing storage SELECT policy for the Driver after upload.
  const tenantAnchor = driver.companyId ?? driver.driverId;
  const storagePath = `${tenantAnchor}/${driver.driverId}/${randomUUID()}.${extension}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('driver-docs')
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });

  if (storageError) {
    return json(500, { error: 'The file upload failed. Please try again.' });
  }

  const { data: record, error: recordError } = await supabaseAdmin
    .from('driver_documents')
    .insert({
      driver_id: driver.driverId,
      doc_type: docType,
      file_path: storagePath,
      issued_date: issuedDate || null,
      expiry_date: expiryDate || null,
      status: 'pending',
    })
    .select('id, doc_type, status, created_at')
    .single();

  if (recordError) {
    await supabaseAdmin.storage.from('driver-docs').remove([storagePath]);
    return json(500, {
      error: 'The document record could not be created. The uploaded file was removed safely.',
    });
  }

  return json(201, { ok: true, document: record });
}
