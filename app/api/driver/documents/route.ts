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

type UploadRecordRequest = {
  storagePath?: unknown;
  docType?: unknown;
  issuedDate?: unknown;
  expiryDate?: unknown;
  mimeType?: unknown;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function cleanText(value: unknown, max = 300) {
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

async function removeStoredObject(storagePath: string) {
  await supabaseAdmin!.storage.from('driver-docs').remove([storagePath]);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document upload is temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as UploadRecordRequest | null;
  if (!body) return json(400, { error: 'The document upload request is invalid.' });

  const storagePath = cleanText(body.storagePath, 500);
  const docType = cleanText(body.docType, 100);
  const issuedDate = cleanText(body.issuedDate, 10);
  const expiryDate = cleanText(body.expiryDate, 10);
  const mimeType = cleanText(body.mimeType, 100).toLowerCase();
  const extension = MIME_EXTENSION[mimeType];

  if (!ALLOWED_DOCUMENT_TYPES.has(docType)) {
    return json(400, { error: 'Choose a supported document type.' });
  }
  if (!validIsoDate(issuedDate) || !validIsoDate(expiryDate)) {
    return json(400, { error: 'Issue and expiry dates must be valid dates.' });
  }
  if (issuedDate && expiryDate && expiryDate < issuedDate) {
    return json(400, { error: 'Expiry date cannot be before the issue date.' });
  }
  if (!extension) {
    return json(415, { error: 'Use a PDF, JPG, PNG or WEBP document.' });
  }

  const tenantAnchor = driver.companyId ?? driver.driverId;
  const segments = storagePath.split('/');
  const expectedPrefix = `${tenantAnchor}/${driver.driverId}/`;
  if (
    segments.length !== 3
    || !storagePath.startsWith(expectedPrefix)
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
    || !storagePath.toLowerCase().endsWith(`.${extension}`)
  ) {
    return json(403, { error: 'The uploaded document does not belong to this Driver account.' });
  }

  // Retry-safe: a network interruption after a successful insert must not create
  // a duplicate record or tempt the browser to delete a file already in use.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('driver_documents')
    .select('id, doc_type, status, created_at')
    .eq('driver_id', driver.driverId)
    .eq('file_path', storagePath)
    .maybeSingle();
  if (existingError) {
    return json(500, { error: 'The existing document record could not be checked.' });
  }
  if (existing) {
    return json(200, { ok: true, document: existing, idempotent: true });
  }

  const { data: storedFile, error: downloadError } = await supabaseAdmin.storage
    .from('driver-docs')
    .download(storagePath);
  if (downloadError || !storedFile) {
    return json(404, { error: 'The uploaded file could not be found in secure storage.' });
  }

  const bytes = Buffer.from(await storedFile.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    await removeStoredObject(storagePath);
    return json(413, { error: 'File must be 10 MB or smaller.' });
  }
  if (!hasExpectedMagicBytes(bytes, mimeType)) {
    await removeStoredObject(storagePath);
    return json(415, { error: 'Document content does not match its declared file type.' });
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
    await removeStoredObject(storagePath);
    return json(500, {
      error: 'The document record could not be created. The uploaded file was removed safely.',
    });
  }

  return json(201, { ok: true, document: record, idempotent: false });
}
