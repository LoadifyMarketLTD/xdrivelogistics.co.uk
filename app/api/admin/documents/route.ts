import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isCompanyAdminContext, requireCompanyAdmin } from '../_lib/requireCompanyAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DRIVER_DOC_TYPES = new Set([
  'Driving Licence',
  'CPC Card',
  'Tacho Card',
  'DBS Certificate',
  'Medical Certificate',
  'Insurance',
  'Other',
]);
const VEHICLE_DOC_TYPES = new Set([
  'MOT',
  'Road Tax',
  'Insurance',
  'Operator Licence',
  'Goods Vehicle Test',
  'Other',
]);

const MIME_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

type DocumentKind = 'driver' | 'vehicle';
type UploadRecordRequest = {
  companyId?: unknown;
  kind?: unknown;
  subjectId?: unknown;
  storagePath?: unknown;
  docType?: unknown;
  issuedDate?: unknown;
  expiryDate?: unknown;
  mimeType?: unknown;
};

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });

const cleanText = (value: unknown, max = 300) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const validIsoDate = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const hasExpectedMagicBytes = (bytes: Buffer, mimeType: string) => {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
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
};

const safeStoragePath = (
  storagePath: string,
  companyId: string,
  subjectId: string,
  allowedExtensions: string[],
) => {
  const segments = storagePath.split('/');
  if (segments.length !== 3) return false;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return false;
  if (segments[0] !== companyId || segments[1] !== subjectId) return false;
  const extension = segments[2].split('.').pop()?.toLowerCase() ?? '';
  return allowedExtensions.includes(extension);
};

async function removeStoredObject(bucket: string, storagePath: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.storage.from(bucket).remove([storagePath]);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document service is temporarily unavailable.' });
  }

  const body = await request.json().catch(() => null) as UploadRecordRequest | null;
  if (!body) return json(400, { error: 'Invalid document request.' });

  const companyId = cleanText(body.companyId, 80);
  const admin = await requireCompanyAdmin(request, companyId);
  if (!isCompanyAdminContext(admin)) return admin;

  const kind = cleanText(body.kind, 20) as DocumentKind;
  const subjectId = cleanText(body.subjectId, 80);
  const storagePath = cleanText(body.storagePath, 500);
  const docType = cleanText(body.docType, 100);
  const issuedDate = cleanText(body.issuedDate, 10);
  const expiryDate = cleanText(body.expiryDate, 10);
  const mimeType = cleanText(body.mimeType, 100).toLowerCase();

  if (kind !== 'driver' && kind !== 'vehicle') {
    return json(400, { error: 'Document kind must be driver or vehicle.' });
  }
  if (!subjectId || !storagePath) {
    return json(400, { error: 'Subject and uploaded storage path are required.' });
  }

  const allowedDocTypes = kind === 'driver' ? DRIVER_DOC_TYPES : VEHICLE_DOC_TYPES;
  if (!allowedDocTypes.has(docType)) {
    return json(400, { error: 'Choose a supported document type.' });
  }
  if (!validIsoDate(issuedDate) || !validIsoDate(expiryDate)) {
    return json(400, { error: 'Issue and expiry dates must be valid dates.' });
  }
  if (issuedDate && expiryDate && expiryDate < issuedDate) {
    return json(400, { error: 'Expiry date cannot be before the issue date.' });
  }

  const allowedExtensions = MIME_EXTENSIONS[mimeType];
  if (!allowedExtensions) {
    return json(415, { error: 'Use a PDF, JPG, PNG or WEBP document.' });
  }
  if (!safeStoragePath(storagePath, admin.companyId, subjectId, allowedExtensions)) {
    return json(403, { error: 'Uploaded document path does not belong to this company resource.' });
  }

  const subjectTable = kind === 'driver' ? 'drivers' : 'vehicles';
  const { data: subject, error: subjectError } = await supabaseAdmin
    .from(subjectTable)
    .select('id, company_id')
    .eq('id', subjectId)
    .eq('company_id', admin.companyId)
    .maybeSingle();

  if (subjectError) return json(500, { error: 'Unable to verify document subject.' });
  if (!subject) return json(404, { error: `${kind === 'driver' ? 'Driver' : 'Vehicle'} not found for this company.` });

  const bucket = kind === 'driver' ? 'driver-docs' : 'vehicle-docs';
  const table = kind === 'driver' ? 'driver_documents' : 'vehicle_documents';
  const subjectColumn = kind === 'driver' ? 'driver_id' : 'vehicle_id';

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(table)
    .select('id, doc_type, status, file_path, created_at')
    .eq(subjectColumn, subjectId)
    .eq('file_path', storagePath)
    .maybeSingle();
  if (existingError) return json(500, { error: 'Unable to verify existing document record.' });
  if (existing) {
    return json(200, { ok: true, document: existing, idempotent: true });
  }

  const { data: storedFile, error: downloadError } = await supabaseAdmin.storage
    .from(bucket)
    .download(storagePath);
  if (downloadError || !storedFile) {
    return json(404, { error: 'Uploaded file could not be found in secure storage.' });
  }

  const bytes = Buffer.from(await storedFile.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    await removeStoredObject(bucket, storagePath);
    return json(413, { error: 'File must be 10 MB or smaller.' });
  }
  if (!hasExpectedMagicBytes(bytes, mimeType)) {
    await removeStoredObject(bucket, storagePath);
    return json(415, { error: 'Document content does not match its declared file type.' });
  }

  const record: Record<string, string | null> = {
    [subjectColumn]: subjectId,
    doc_type: docType,
    file_path: storagePath,
    issued_date: issuedDate || null,
    expiry_date: expiryDate || null,
    status: 'pending',
  };
  if (kind === 'vehicle') record.uploaded_by = admin.userId;

  const { data: created, error: createError } = await supabaseAdmin
    .from(table)
    .insert(record)
    .select(`id, ${subjectColumn}, doc_type, file_path, issued_date, expiry_date, status, created_at`)
    .single();

  if (createError) {
    await removeStoredObject(bucket, storagePath);
    return json(500, {
      error: 'Document record could not be created. Uploaded file was removed safely.',
    });
  }

  return json(201, {
    ok: true,
    document: created,
    idempotent: false,
    review: 'pending_platform_owner_review',
  });
}
