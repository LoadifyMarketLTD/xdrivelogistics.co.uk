import path from 'path';
import { NextRequest } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, createUserScopedClient } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

export async function POST(request: NextRequest) {
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return respond(400, { error: 'Expected multipart/form-data.' });
  }

  const file = formData.get('file');
  const jobId = String(formData.get('jobId') ?? '').trim();

  if (!(file instanceof File)) {
    return respond(400, { error: 'No file provided.' });
  }
  if (!jobId) {
    return respond(400, { error: 'jobId is required.' });
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return respond(413, { error: 'File must be between 1 byte and 20 MB.' });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return respond(415, { error: 'Only JPEG, PNG, WebP images and PDF documents are allowed.' });
  }

  // Verify the job is assigned to this driver
  const { data: job, error: jobError } = await driver.db
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found or not assigned to this driver.' });

  // Use service-role client for storage if available, otherwise use user-scoped client
  const storageClient =
    isSupabaseAdminConfigured && supabaseAdmin
      ? supabaseAdmin
      : createUserScopedClient(getBearerToken(request) ?? '');

  if (!storageClient) {
    return respond(503, { error: 'Storage is not configured.' });
  }

  const ext = path.extname(file.name || '').toLowerCase() || (file.type === 'application/pdf' ? '.pdf' : '.jpg');
  const fileName = sanitizeFilename(`${Date.now()}${ext}`);
  const objectPath = `${jobId}/${fileName}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await storageClient.storage
    .from('pod-docs')
    .upload(objectPath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return respond(500, { error: uploadError.message });
  }

  return respond(200, { path: objectPath });
}
