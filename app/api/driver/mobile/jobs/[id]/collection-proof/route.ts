import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { insertTrackingEvent, isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../../../_lib';

/**
 * POST /api/driver/mobile/jobs/{jobId}/collection-proof
 *
 * Server-mediated collection proof finalisation. Called after the driver
 * uploads a collection photo using the pod-upload-init signed URL.
 *
 * Idempotent: the same podKey replays as 200 with the current job state.
 * A different podKey after the first confirmed write returns 409.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id: jobId } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const podKey = typeof body.podKey === 'string' ? body.podKey.trim() : '';
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(podKey)) {
    return respond(400, { error: 'A valid collection proof idempotency key is required.' });
  }

  const collectionPath = typeof body.collectionPath === 'string' ? body.collectionPath.trim() : '';

  // Path must be a canonical collection path: {jobId}/collection/{evidenceId}-{name}
  const validCollectionPath =
    collectionPath.length > 0 &&
    collectionPath.length <= 1024 &&
    collectionPath.startsWith(`${jobId}/collection/`) &&
    !collectionPath.includes('://') &&
    !collectionPath.includes('..') &&
    !collectionPath.includes('\\') &&
    !collectionPath.startsWith('/');

  if (!validCollectionPath) {
    return respond(400, {
      error: 'Collection photo must be uploaded to XDrive storage before submission.',
    });
  }

  // --- Load and validate job assignment ---
  const { data: existing, error: loadError } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Job not found.' });

  const job = existing as unknown as MobileJobRow;

  // --- Idempotency gate ---
  if (job.collection_proof_idempotency_key) {
    if (job.collection_proof_idempotency_key === podKey) {
      // Same key: replay — return current state.
      return respond(200, { ok: true, job: mapJob(job) });
    }
    // Different key after a confirmed write: conflict.
    return respond(409, {
      error: 'A different collection proof has already been submitted for this job.',
    });
  }

  // --- Verify the file exists in storage ---
  const segments = collectionPath.split('/');
  const fileName = segments.pop();
  const folder = segments.join('/');
  if (!fileName || !folder) {
    return respond(400, { error: 'Collection photo path is malformed.' });
  }
  const { data: listing, error: listError } = await supabaseAdmin.storage
    .from('pod-photos')
    .list(folder, { limit: 100, search: fileName });
  if (listError) {
    return respond(503, { error: `Collection photo storage could not be verified: ${listError.message}` });
  }
  if (!(listing ?? []).some((entry: { name: string }) => entry.name === fileName)) {
    return respond(400, { error: 'Collection photo could not be found in XDrive storage.' });
  }

  // --- Write collection proof atomically ---
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update({
      collection_photo_url: collectionPath,
      collection_proof_idempotency_key: podKey,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .or(`collection_proof_idempotency_key.is.null,collection_proof_idempotency_key.eq.${podKey}`)
    .select(jobSelect)
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) {
    return respond(409, {
      error: 'A different collection proof is already being processed for this job.',
    });
  }

  await insertTrackingEvent(jobId, driver.userId, 'note', 'Collection proof submitted');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}
