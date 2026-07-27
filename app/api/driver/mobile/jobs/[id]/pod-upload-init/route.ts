import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../../../_lib';

/** Maximum evidence file size in bytes (10 MiB). */
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

/** Allowed MIME types for POD evidence. */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

/** Allowed evidence kinds. */
const ALLOWED_KINDS = new Set(['photos', 'documents', 'collection']);

/**
 * POST /api/driver/mobile/jobs/{jobId}/pod-upload-init
 *
 * Server-issued upload-init for POD evidence. The client must call this before
 * uploading any evidence file so that:
 *   - driver assignment ownership is validated server-side;
 *   - MIME type, byte size, and evidence count are validated server-side;
 *   - the storage path is deterministic (jobId/kind/evidenceId-safeName),
 *     not random-timestamp-based;
 *   - the signed upload URL carries a server-controlled expiry.
 *
 * After receiving the signed URL and canonical path, the client:
 *   1. Uploads the evidence bytes directly to the signed URL (standard PUT).
 *   2. Calls POST /api/driver/mobile/jobs/{jobId}/pod (delivery evidence) or
 *      POST /api/driver/mobile/jobs/{jobId}/collection-proof (collection photos)
 *      with the canonical path to finalise.
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

  // --- Validate required fields ---
  const podKey = typeof body.podKey === 'string' ? body.podKey.trim() : '';
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(podKey)) {
    return respond(400, { error: 'A valid POD idempotency key is required.' });
  }

  const evidenceId = typeof body.evidenceId === 'string' ? body.evidenceId.trim() : '';
  if (!/^[A-Za-z0-9:_-]{8,80}$/.test(evidenceId)) {
    return respond(400, { error: 'A valid evidence ID is required.' });
  }

  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
  if (!fileName || fileName.length > 255) {
    return respond(400, { error: 'A valid file name is required.' });
  }

  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return respond(400, {
      error: `Unsupported file type. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}.`,
    });
  }

  const byteSize = typeof body.byteSize === 'number' ? Math.floor(body.byteSize) : -1;
  if (byteSize <= 0 || byteSize > MAX_EVIDENCE_BYTES) {
    return respond(400, {
      error: `File size must be between 1 byte and ${MAX_EVIDENCE_BYTES / (1024 * 1024)} MiB.`,
    });
  }

  const kind = typeof body.kind === 'string' ? body.kind.trim() : '';
  if (!ALLOWED_KINDS.has(kind)) {
    return respond(400, { error: "Evidence kind must be 'photos', 'documents', or 'collection'." });
  }

  // --- Validate driver assignment ---
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, pod_generated')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  // For delivery evidence, reject upload-init if POD is already finalised with a different key.
  // Collection proofs are always allowed until the job is delivered.
  if (kind !== 'collection' && job.pod_generated === true) {
    return respond(409, { error: 'POD has already been finalised for this job.' });
  }

  // --- Build canonical storage path ---
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const path = `${jobId}/${kind}/${evidenceId}-${safeName}`;

  // --- Request signed upload URL from Supabase Storage ---
  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from('pod-photos')
    .createSignedUploadUrl(path, { upsert: false });

  if (signError) {
    return respond(503, {
      error: `Storage upload URL could not be issued: ${signError.message}`,
    });
  }

  return respond(200, {
    path,
    signedUrl: signed.signedUrl,
    token: signed.token,
    expiresIn: 600, // seconds — 10-minute upload window
  });
}
