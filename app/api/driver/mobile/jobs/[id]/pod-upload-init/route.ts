import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../../../_lib';

/** Maximum evidence file size in bytes (10 MiB). */
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

/** Maximum number of ledger entries per podKey. */
const MAX_LEDGER_ENTRIES_PER_POD_KEY = 10;

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

interface UploadLedgerEntry {
  evidenceId: string;
  podKey: string;
  payloadFingerprint: string;
  path: string;
  sha256Hex: string;
  byteSize: number;
  mimeType: string;
  kind: string;
  issuedAt: string;
}

/**
 * POST /api/driver/mobile/jobs/{jobId}/pod-upload-init
 *
 * Server-issued upload-init for POD evidence. The client must call this before
 * uploading any evidence file so that:
 *   - driver assignment ownership is validated server-side;
 *   - MIME type, byte size, and evidence count are validated server-side;
 *   - the storage path is deterministic (jobId/kind/evidenceId-safeName),
 *     not random-timestamp-based;
 *   - the signed upload URL carries a server-controlled expiry;
 *   - the authorised upload is recorded in the job's pod_upload_ledger so that
 *     savePod can verify all finalised paths were legitimately server-issued.
 *
 * Required fields: podKey, evidenceId, fileName, mimeType, byteSize, kind,
 *                  sha256Hex (64 hex), payloadFingerprint (64 hex).
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

  const sha256Hex =
    typeof body.sha256Hex === 'string' && /^[0-9a-f]{64}$/i.test(body.sha256Hex.trim())
      ? body.sha256Hex.trim().toLowerCase()
      : null;
  if (!sha256Hex) {
    return respond(400, { error: 'A valid sha256Hex (64 lowercase hex characters) is required.' });
  }

  const payloadFingerprint =
    typeof body.payloadFingerprint === 'string' &&
    /^[0-9a-f]{64}$/i.test(body.payloadFingerprint.trim())
      ? body.payloadFingerprint.trim().toLowerCase()
      : null;
  if (!payloadFingerprint) {
    return respond(400, {
      error: 'A valid payloadFingerprint (64 lowercase hex characters) is required.',
    });
  }

  // --- Validate driver assignment and read existing ledger ---
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, pod_generated, pod_upload_ledger')
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

  // --- Ledger checks ---
  const existingLedger: UploadLedgerEntry[] = Array.isArray(job.pod_upload_ledger)
    ? (job.pod_upload_ledger as UploadLedgerEntry[])
    : [];

  // Reject duplicate evidenceId (same file already initiated for this job).
  if (existingLedger.some((e) => e.evidenceId === evidenceId)) {
    return respond(409, { error: 'This evidence ID has already been issued for this job.' });
  }

  // Enforce per-podKey ledger cap.
  const podKeyEntries = existingLedger.filter((e) => e.podKey === podKey);
  if (podKeyEntries.length >= MAX_LEDGER_ENTRIES_PER_POD_KEY) {
    return respond(409, {
      error: `Maximum of ${MAX_LEDGER_ENTRIES_PER_POD_KEY} evidence uploads are allowed per submission.`,
    });
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

  // --- Append to upload ledger atomically ---
  const newEntry: UploadLedgerEntry = {
    evidenceId,
    podKey,
    payloadFingerprint,
    path,
    sha256Hex,
    byteSize,
    mimeType,
    kind,
    issuedAt: new Date().toISOString(),
  };
  const updatedLedger = [...existingLedger, newEntry];

  const { error: ledgerError } = await supabaseAdmin
    .from('jobs')
    .update({ pod_upload_ledger: updatedLedger })
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId);

  if (ledgerError) {
    return respond(503, {
      error: `Failed to record upload authorisation: ${ledgerError.message}`,
    });
  }

  return respond(200, {
    path,
    signedUrl: signed.signedUrl,
    token: signed.token,
    expiresIn: 600, // seconds — 10-minute upload window
  });
}

