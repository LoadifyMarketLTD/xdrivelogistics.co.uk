import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isComplianceDriverContext, resolveComplianceDriver } from '../_lib';

export const runtime = 'nodejs';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const docTypeSchema = z.enum(['mot', 'insurance']);
const uuidSchema = z.string().uuid();

const validIsoDate = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const hasExpectedMagicBytes = (bytes: Buffer, mimeType: string) => {
  if (mimeType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  return false;
};

export async function POST(request: NextRequest) {
  const resolved = await resolveComplianceDriver(request);
  if (!isComplianceDriverContext(resolved)) return resolved;

  const formData = await request.formData().catch(() => null);
  if (!formData) return json(400, { error: 'Invalid vehicle document upload request.' });

  const file = formData.get('file');
  const vehicleIdResult = uuidSchema.safeParse(String(formData.get('vehicleId') ?? '').trim());
  const docTypeResult = docTypeSchema.safeParse(String(formData.get('docType') ?? '').trim().toLowerCase());
  const issuedDate = String(formData.get('issuedDate') ?? '').trim();
  const expiryDate = String(formData.get('expiryDate') ?? '').trim();

  if (!(file instanceof File)) return json(400, { error: 'Choose a vehicle compliance document.' });
  if (!vehicleIdResult.success) return json(400, { error: 'A valid vehicle is required.' });
  if (!docTypeResult.success) return json(400, { error: 'Choose MOT or Vehicle Insurance.' });
  if (!validIsoDate(issuedDate) || !validIsoDate(expiryDate)) {
    return json(400, { error: 'Issue and expiry dates must be valid dates.' });
  }
  if (issuedDate && expiryDate && expiryDate < issuedDate) {
    return json(400, { error: 'Expiry date cannot be before the issue date.' });
  }
  if (!expiryDate) {
    return json(400, { error: 'An expiry date is required for MOT and Vehicle Insurance.' });
  }

  const mimeType = file.type.toLowerCase();
  const extension = MIME_EXTENSION[mimeType];
  if (!extension) return json(415, { error: 'Use a PDF, JPG or PNG document.' });
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
    return json(413, { error: 'Vehicle document must be 10 MB or smaller.' });
  }

  const { data: vehicle, error: vehicleError } = await supabaseAdmin!
    .from('vehicles')
    .select('id,company_id,assigned_driver_id,status,registration')
    .eq('id', vehicleIdResult.data)
    .maybeSingle();
  if (vehicleError) return json(500, { error: 'Vehicle assignment could not be verified.' });
  if (!vehicle) return json(404, { error: 'Vehicle not found.' });
  if (vehicle.company_id !== resolved.companyId || vehicle.assigned_driver_id !== resolved.driverId) {
    return json(403, { error: 'Only the active vehicle assigned to this Driver can receive compliance evidence.' });
  }
  if (String(vehicle.status ?? '').trim().toLowerCase() !== 'active') {
    return json(409, { error: 'Vehicle compliance can only be submitted for an active assigned vehicle.' });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedMagicBytes(bytes, mimeType)) {
    return json(415, { error: 'Vehicle document content does not match its declared file type.' });
  }
  const fileSha256 = crypto.createHash('sha256').update(bytes).digest('hex');

  const { data: existing, error: existingError } = await supabaseAdmin!
    .from('vehicle_documents')
    .select('id,vehicle_id,doc_type,status,expiry_date,created_at')
    .eq('vehicle_id', vehicle.id)
    .eq('doc_type', docTypeResult.data)
    .eq('file_sha256', fileSha256)
    .limit(1)
    .maybeSingle();
  if (existingError) return json(500, { error: 'Existing vehicle compliance evidence could not be checked.' });
  if (existing) return json(200, { ok: true, document: existing, idempotent: true });

  const objectPath = `${resolved.companyId}/${vehicle.id}/${Date.now()}-${docTypeResult.data}-${fileSha256.slice(0, 12)}.${extension}`;
  const { error: uploadError } = await supabaseAdmin!.storage
    .from('vehicle-docs')
    .upload(objectPath, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) return json(500, { error: 'Vehicle compliance evidence could not be stored securely.' });

  const { data: inserted, error: insertError } = await supabaseAdmin!
    .from('vehicle_documents')
    .insert({
      vehicle_id: vehicle.id,
      document_name: file.name.slice(0, 300),
      doc_type: docTypeResult.data,
      file_path: objectPath,
      issued_date: issuedDate || null,
      expiry_date: expiryDate,
      uploaded_by: resolved.userId,
      file_sha256: fileSha256,
      status: 'pending',
    })
    .select('id,vehicle_id,doc_type,status,expiry_date,created_at')
    .single();

  if (insertError || !inserted) {
    await supabaseAdmin!.storage.from('vehicle-docs').remove([objectPath]);
    return json(500, { error: 'Vehicle compliance record could not be created. The uploaded file was removed safely.' });
  }

  return json(201, { ok: true, document: inserted, idempotent: false });
}
