import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { autoGenerateMarketplaceInvoice } from '../../../../../_lib/autoGenerateMarketplaceInvoice';
import {
  appendStatusHistory,
  hasPod,
  insertTrackingEvent,
  isDriverContext,
  jobSelect,
  mapJob,
  MobileJobRow,
  requireDriver,
  respond,
  safeArray,
} from '../../../_lib';
import { hasActionAlreadyApplied, normalizedCurrentOrNull } from './idempotency';
import { actions, validateLifecycleActionTransition } from './lifecycle';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id, action } = await params;
  if (action === 'pod') return savePod(request, id, driver.userId, driver.driverId);

  const config = actions[action];
  if (!config) return respond(404, { error: 'Unsupported driver action.' });

  const { data: existing, error: loadError } = await supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Job not found.' });

  const job = existing as unknown as MobileJobRow;

  // Idempotency FIRST — before lifecycle validation.
  // An offline-queue retry arrives after the transition has already been
  // applied.  At that point job.status may have advanced past the values in
  // allowedLifecycle, so the lifecycle check would return 409 instead of 200.
  // Check granular status/timestamps/history first to prevent false 409 rejects.
  if (hasActionAlreadyApplied(job, { currentStatus: config.toStatus, timestampField: config.timestampField })) {
    return respond(200, { ok: true, job: mapJob(job) });
  }
  const currentStatus = normalizedCurrentOrNull(job.current_status);

  // Enforce strict adjacent canonical transition rules.
  const transitionCheck = validateLifecycleActionTransition(action, currentStatus);
  if (!transitionCheck.ok) {
    return respond(409, {
      error: `Job cannot perform ${action} from ${currentStatus ?? 'unset'} current status.`,
    });
  }

  if (config.requiresPod && job.pod_required !== false && !hasPod(job)) {
    return respond(409, { error: 'POD is required before marking this job delivered.' });
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    current_status: config.toStatus,
    status: config.toStatus,
    status_updated_at: now,
    updated_at: now,
    status_history: appendStatusHistory(job.status_history, {
      status: config.toStatus,
      lifecycle_status: config.toStatus,
      label: config.label,
      timestamp: now,
      actor_user_id: driver.userId,
      source: 'driver_mobile',
    }),
  };
  if (config.timestampField) updatePayload[config.timestampField] = now;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(updatePayload)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .select(jobSelect)
    .single();

  if (updateError) return respond(500, { error: updateError.message });
  await insertTrackingEvent(id, driver.userId, config.eventType, config.label);
  const updatedJob = updated as unknown as MobileJobRow & { awarded_carrier_company_id?: string | null };

  if (action === 'delivered') {
    const carrierCompanyId = typeof updatedJob.awarded_carrier_company_id === 'string'
      ? updatedJob.awarded_carrier_company_id
      : null;
    if (carrierCompanyId) {
      try {
        await autoGenerateMarketplaceInvoice({
          supabase: supabaseAdmin!,
          jobId: id,
          supplierCompanyId: carrierCompanyId,
          actorUserId: driver.userId,
          idempotencyKey: `auto-pod-${id}`,
        });
      } catch (reason) {
        console.error(
          'Driver status update succeeded but auto invoice generation failed:',
          reason instanceof Error ? reason.message : reason
        );
      }
    }
  }

  return respond(200, { ok: true, job: mapJob(updatedJob) });
}

const persistentPodPath = (
  jobId: string,
  kind: 'photos' | 'documents',
  value: unknown
): value is string => {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  return (
    path.length > 0 &&
    path.length <= 1024 &&
    path.startsWith(`${jobId}/${kind}/`) &&
    !path.includes('://') &&
    !path.includes('..') &&
    !path.includes('\\') &&
    !path.startsWith('/')
  );
};

const storageObjectExists = async (path: string) => {
  const segments = path.split('/');
  const fileName = segments.pop();
  const folder = segments.join('/');
  if (!fileName || !folder) return false;

  const { data, error } = await supabaseAdmin!.storage
    .from('pod-photos')
    .list(folder, { limit: 100, search: fileName });
  if (error) throw new Error(error.message);
  return (data ?? []).some((entry) => entry.name === fileName);
};

async function savePod(request: NextRequest, jobId: string, userId: string, driverId: string) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { data: existing, error: loadError } = await supabaseAdmin!
    .from('jobs')
    .select(jobSelect)
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .maybeSingle();

  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Job not found.' });

  const job = existing as unknown as MobileJobRow;
  const podKey = typeof body.podKey === 'string'
    ? body.podKey.trim()
    : typeof body.idempotencyKey === 'string'
      ? body.idempotencyKey.trim()
      : '';
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(podKey)) {
    return respond(400, { error: 'A valid POD idempotency key is required.' });
  }

  // Idempotency gate: completed POD can be replayed only with the same key.
  // A different key after completion is treated as a distinct submission and is rejected.
  if (job.pod_generated === true) {
    if (job.pod_submission_idempotency_key && job.pod_submission_idempotency_key === podKey) {
      return respond(200, { ok: true, job: mapJob(job) });
    }
    if (!job.pod_submission_idempotency_key) {
      // Legacy row saved before key persistence was introduced.
      return respond(200, { ok: true, job: mapJob(job) });
    }
    return respond(409, { error: 'POD has already been submitted for this job.' });
  }

  if (job.pod_submission_idempotency_key && job.pod_submission_idempotency_key !== podKey) {
    return respond(409, { error: 'A different POD submission is already pending for this job.' });
  }
  if (job.pod_submission_idempotency_key === podKey) {
    return respond(200, { ok: true, job: mapJob(job) });
  }

  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  const rawSignature = typeof body.signatureData === 'string' ? body.signatureData.trim() : '';
  const rawPhotoUris = safeArray(body.photoUris);
  const rawDocumentUris = safeArray(body.documentUris);

  if (!recipientName) return respond(400, { error: 'Recipient name is required for POD.' });
  if (recipientName.length > 200) return respond(400, { error: 'Recipient name is too long.' });
  if (rawPhotoUris.length > 10 || rawDocumentUris.length > 10) {
    return respond(400, { error: 'A maximum of 10 POD photos and 10 documents is allowed.' });
  }
  if (rawSignature && !/^data:image\/(png|jpeg);base64,/i.test(rawSignature)) {
    return respond(400, { error: 'Recipient signature format is invalid.' });
  }
  if (rawSignature.length > 2_500_000) {
    return respond(413, { error: 'Recipient signature is too large.' });
  }

  const photoPaths = rawPhotoUris.filter((value) => persistentPodPath(jobId, 'photos', value));
  const documentPaths = rawDocumentUris.filter((value) => persistentPodPath(jobId, 'documents', value));
  if (photoPaths.length !== rawPhotoUris.length || documentPaths.length !== rawDocumentUris.length) {
    return respond(400, { error: 'POD files must be uploaded to XDrive storage before submission.' });
  }
  if (!rawSignature && photoPaths.length + documentPaths.length === 0) {
    return respond(400, { error: 'A recipient signature, POD photo or POD document is required.' });
  }

  try {
    const existenceChecks = await Promise.all(
      [...photoPaths, ...documentPaths].map((path) => storageObjectExists(path))
    );
    if (existenceChecks.some((exists) => !exists)) {
      return respond(400, { error: 'One or more POD files could not be found in XDrive storage.' });
    }
  } catch (reason) {
    return respond(503, {
      error: reason instanceof Error
        ? `POD storage could not be verified: ${reason.message}`
        : 'POD storage could not be verified.',
    });
  }

  const now = new Date().toISOString();
  const existingPhotos = safeArray(job.delivery_photos).filter((item): item is string => typeof item === 'string');
  const existingDocuments = safeArray(job.pod_photos).filter((item): item is string => typeof item === 'string');
  const signatureData = rawSignature
    ? {
        type: 'driver_mobile_signature',
        value: rawSignature,
        captured_at: now,
        captured_by: userId,
      }
    : job.delivery_signature_data ?? null;

  const { data: updated, error: updateError } = await supabaseAdmin!
    .from('jobs')
    .update({
      delivery_photos: [...existingPhotos, ...photoPaths],
      pod_photos: [...existingDocuments, ...documentPaths],
      delivery_signature_data: signatureData,
      client_signature_name: recipientName,
      delivery_notes: typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim().slice(0, 5000)
        : null,
      pod_generated: true,
      pod_generated_at: now,
      pod_submission_idempotency_key: podKey,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .or(`pod_submission_idempotency_key.is.null,pod_submission_idempotency_key.eq.${podKey}`)
    .select(jobSelect)
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) {
    return respond(409, { error: 'A different POD submission is already being processed for this job.' });
  }
  await insertTrackingEvent(jobId, userId, 'note', 'Persistent POD evidence uploaded');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}
