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

type DriverDocumentRow = {
  id: string;
  doc_type: string;
  file_path: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  status?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
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
  return supabaseAdmin!.storage.from('driver-docs').remove([storagePath]);
}

async function deleteDriverDocumentRows(rows: DriverDocumentRow[]) {
  if (rows.length === 0) return { deleted: 0, error: null as string | null };

  const storagePaths = rows.map((row) => cleanText(row.file_path, 500)).filter(Boolean);
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabaseAdmin!.storage.from('driver-docs').remove(storagePaths);
    if (storageError) {
      return { deleted: 0, error: 'The old document file could not be removed from secure storage.' };
    }
  }

  const ids = rows.map((row) => row.id).filter(Boolean);
  const { error: deleteError } = await supabaseAdmin!
    .from('driver_documents')
    .delete()
    .in('id', ids);

  if (deleteError) {
    return { deleted: 0, error: 'The old document record could not be removed.' };
  }
  return { deleted: ids.length, error: null as string | null };
}

async function purgeExpiredDriverDocuments(driverId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin!
    .from('driver_documents')
    .select('id, doc_type, file_path, expiry_date')
    .eq('driver_id', driverId)
    .not('expiry_date', 'is', null)
    .lt('expiry_date', today);

  if (error) return { deleted: 0, error: 'Expired documents could not be checked.' };
  return deleteDriverDocumentRows((data ?? []) as DriverDocumentRow[]);
}

async function purgeReplacedDriverDocuments(driverId: string, docType: string, keepId: string) {
  const { data, error } = await supabaseAdmin!
    .from('driver_documents')
    .select('id, doc_type, file_path, expiry_date')
    .eq('driver_id', driverId)
    .eq('doc_type', docType)
    .neq('id', keepId);

  if (error) return { deleted: 0, error: 'Replaced documents could not be checked.' };
  return deleteDriverDocumentRows((data ?? []) as DriverDocumentRow[]);
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document service is temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const cleanup = await purgeExpiredDriverDocuments(driver.driverId);
  if (cleanup.error) return json(500, { error: cleanup.error });

  const { data, error } = await supabaseAdmin
    .from('driver_documents')
    .select('id, doc_type, file_path, issued_date, expiry_date, status, rejection_reason, created_at')
    .eq('driver_id', driver.driverId)
    .order('created_at', { ascending: false });

  if (error) return json(500, { error: 'Your compliance documents could not be loaded.' });

  return json(200, {
    documents: data ?? [],
    cleanup: { expiredDeleted: cleanup.deleted },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Document upload is temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const expiredCleanup = await purgeExpiredDriverDocuments(driver.driverId);
  if (expiredCleanup.error) return json(500, { error: expiredCleanup.error });

  const body = await request.json().catch(() => null) as UploadRecordRequest | null;
  if (!body) return json(400, { error: 'The document upload request is invalid.' });

  const storagePath = cleanText(body.storagePath, 500);
  const docType = cleanText(body.docType, 100);
  const issuedDate = cleanText(body.issuedDate, 10);
  const expiryDate = cleanText(body.expiryDate, 10);
  const mimeType = cleanText(body.mimeType, 100).toLowerCase();
  const extension = MIME_EXTENSION[mimeType];

  if (!ALLOWED_DOCUMENT_TYPES.has(docType)) return json(400, { error: 'Choose a supported document type.' });
  if (!validIsoDate(issuedDate) || !validIsoDate(expiryDate)) return json(400, { error: 'Issue and expiry dates must be valid dates.' });
  if (issuedDate && expiryDate && expiryDate < issuedDate) return json(400, { error: 'Expiry date cannot be before the issue date.' });
  if (!extension) return json(415, { error: 'Use a PDF, JPG, PNG or WEBP document.' });

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

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('driver_documents')
    .select('id, doc_type, status, created_at')
    .eq('driver_id', driver.driverId)
    .eq('file_path', storagePath)
    .maybeSingle();

  if (existingError) return json(500, { error: 'The existing document record could not be checked.' });
  if (existing) {
    const replacedCleanup = await purgeReplacedDriverDocuments(driver.driverId, docType, existing.id);
    if (replacedCleanup.error) return json(500, { error: replacedCleanup.error });
    return json(200, {
      ok: true,
      document: existing,
      idempotent: true,
      cleanup: {
        expiredDeleted: expiredCleanup.deleted,
        replacedDeleted: replacedCleanup.deleted,
      },
    });
  }

  const { data: storedFile, error: downloadError } = await supabaseAdmin.storage
    .from('driver-docs')
    .download(storagePath);
  if (downloadError || !storedFile) return json(404, { error: 'The uploaded file could not be found in secure storage.' });

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
    return json(500, { error: 'The document record could not be created. The uploaded file was removed safely.' });
  }

  const replacedCleanup = await purgeReplacedDriverDocuments(driver.driverId, docType, record.id);
  if (replacedCleanup.error) {
    return json(500, {
      error: `${replacedCleanup.error} The new document was saved, but automatic cleanup needs attention.`,
      document: record,
    });
  }

  return json(201, {
    ok: true,
    document: record,
    idempotent: false,
    cleanup: {
      expiredDeleted: expiredCleanup.deleted,
      replacedDeleted: replacedCleanup.deleted,
    },
  });
}
