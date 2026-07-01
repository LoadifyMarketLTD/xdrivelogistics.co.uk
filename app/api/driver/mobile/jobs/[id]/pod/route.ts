import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: driverRow } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return {
    userId: authData.user.id,
    driverId: driverRow.id as string,
    companyId: driverRow.company_id as string,
  };
}

/**
 * POST /api/driver/mobile/jobs/[id]/pod
 *
 * Body (multipart/form-data):
 *   - type:       'photo' | 'signature' | 'document'
 *   - file:       File (the upload)
 *   - note?:      string
 *
 * Records a POD entry for the job and marks pod_generated = true.
 * File storage is handled via Supabase Storage bucket 'pod-uploads'.
 * The mobile app sends the file; this endpoint stores the reference.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { id } = await params;

  // Verify job belongs to this driver
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, status, pod_required, company_id')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const validStatuses = ['allocated', 'collected', 'in_transit', 'delivered'];
  if (!validStatuses.includes(job.status as string)) {
    return respond(409, {
      error: `POD cannot be uploaded when job status is "${job.status}".`,
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return respond(400, { error: 'Expected multipart/form-data.' });
  }

  const type = (formData.get('type') as string) ?? 'photo';
  const note = (formData.get('note') as string) ?? null;
  const file = formData.get('file') as File | null;

  if (!file) {
    return respond(400, { error: 'Missing file field.' });
  }

  const validTypes = ['photo', 'signature', 'document'];
  if (!validTypes.includes(type)) {
    return respond(400, { error: `Invalid type "${type}". Must be: ${validTypes.join(', ')}.` });
  }

  // Upload file to Supabase Storage
  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${job.company_id}/${id}/${driver.driverId}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const { error: storageError } = await supabaseAdmin.storage
    .from('pod-uploads')
    .upload(storagePath, uint8Array, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (storageError) {
    return respond(500, { error: `Storage upload failed: ${storageError.message}` });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('pod-uploads')
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;
  const now = new Date().toISOString();

  // Insert POD record into job_documents (reuse existing pattern) or pod_photos column
  const podEntry = {
    url: publicUrl,
    type,
    note,
    driver_id: driver.driverId,
    uploaded_at: now,
  };

  // Append to pod_photos JSONB array
  const { data: currentJob } = await supabaseAdmin
    .from('jobs')
    .select('pod_photos')
    .eq('id', id)
    .maybeSingle();

  const existingPhotos = Array.isArray(currentJob?.pod_photos) ? currentJob.pod_photos : [];

  const { error: updateError } = await supabaseAdmin
    .from('jobs')
    .update({
      pod_photos: [...existingPhotos, podEntry],
      pod_generated: true,
      updated_at: now,
    })
    .eq('id', id);

  if (updateError) return respond(500, { error: updateError.message });

  // Write tracking event
  await supabaseAdmin.from('job_tracking_events').insert({
    job_id: id,
    event_type: 'note',
    message: `POD ${type} uploaded`,
    meta: { driver_id: driver.driverId, pod_type: type, url: publicUrl },
    created_at: now,
  });

  return respond(200, { ok: true, url: publicUrl, pod_type: type });
}
