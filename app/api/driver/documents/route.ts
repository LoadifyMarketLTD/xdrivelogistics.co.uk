import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isDriverContext } from '../mobile/_lib';
import { requireWebDriver } from '../_lib/webDriver';

export const runtime = 'nodejs';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ALLOWED_DOC_TYPES = new Set([
  'Driving Licence',
  'Insurance',
  'DBS Certificate',
  'CPC Card',
  'Tacho Card',
  'Medical Certificate',
  'Other',
]);

function textPart(form: FormData, key: string, max: number) {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function optionalDate(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

function hasExpectedMagicBytes(bytes: Buffer, mimeType: string) {
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
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Document services are temporarily unavailable.' }, { status: 503 });
  }

  const context = await requireWebDriver(request, { requireOperationallyActive: false });
  if (!isDriverContext(context)) return context;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'The document upload request is invalid.' }, { status: 400 });
  }

  const docType = textPart(form, 'docType', 100);
  const issuedDate = optionalDate(textPart(form, 'issuedDate', 10));
  const expiryDate = optionalDate(textPart(form, 'expiryDate', 10));
  const filePart = form.get('file');

  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json({ error: 'Choose a supported compliance document type.' }, { status: 400 });
  }
  if (issuedDate === undefined || expiryDate === undefined) {
    return NextResponse.json({ error: 'Issue and expiry dates must be valid calendar dates.' }, { status: 400 });
  }
  if (issuedDate && expiryDate && expiryDate < issuedDate) {
    return NextResponse.json({ error: 'Expiry date cannot be before the issue date.' }, { status: 400 });
  }
  if (!(filePart instanceof File)) {
    return NextResponse.json({ error: 'Select a PDF or image before submitting.' }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(filePart.type)) {
    return NextResponse.json({ error: 'Use a PDF, JPG, PNG or WEBP document.' }, { status: 415 });
  }
  if (filePart.size <= 0 || filePart.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: 'Document must be 10 MB or smaller.' }, { status: 413 });
  }

  const bytes = Buffer.from(await filePart.arrayBuffer());
  if (!hasExpectedMagicBytes(bytes, filePart.type)) {
    return NextResponse.json({ error: 'Document content does not match its declared file type.' }, { status: 415 });
  }

  const safeFileName = (filePart.name || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-160) || 'document';
  const uploadFolder = context.companyId ?? context.driverId;
  const storagePath = `${uploadFolder}/${context.driverId}/${randomUUID()}-${safeFileName}`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('driver-docs')
    .upload(storagePath, bytes, { contentType: filePart.type, upsert: false });

  if (storageError) {
    console.error('driver.document-upload.storage', {
      driverId: context.driverId,
      code: storageError.message,
    });
    return NextResponse.json({ error: 'The file upload failed. Please try again.' }, { status: 500 });
  }

  const { data: document, error: recordError } = await supabaseAdmin
    .from('driver_documents')
    .insert({
      driver_id: context.driverId,
      doc_type: docType,
      file_path: storagePath,
      issued_date: issuedDate,
      expiry_date: expiryDate,
      status: 'pending',
    })
    .select('id,doc_type,file_path,issued_date,expiry_date,status,rejection_reason,created_at')
    .single();

  if (recordError) {
    const { error: cleanupError } = await supabaseAdmin.storage.from('driver-docs').remove([storagePath]);
    console.error('driver.document-upload.record', {
      driverId: context.driverId,
      code: recordError.code,
      message: recordError.message,
      cleanupFailed: Boolean(cleanupError),
    });
    return NextResponse.json({
      error: cleanupError
        ? 'The document record could not be created and the uploaded file requires cleanup.'
        : 'The document record could not be created. The uploaded file was removed safely.',
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document }, { status: 201 });
}
