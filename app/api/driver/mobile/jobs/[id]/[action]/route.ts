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

type ActionConfig = {
  currentStatus: string;
  lifecycleStatus?: string;
  timestampField?: string;
  eventType: string;
  label: string;
  allowedLifecycle: string[];
  /**
   * Canonical current_status values allowed as transition entry points.
   * Null means "no current_status set yet".
   */
  allowedCurrent: Array<string | null>;
  requiresPod?: boolean;
};

const actions: Record<string, ActionConfig> = {
  accept: {
    currentStatus: 'accepted',
    eventType: 'note',
    label: 'Job accepted by driver',
    allowedLifecycle: ['awarded', 'allocated'],
    allowedCurrent: [null, 'awarded', 'allocated'],
  },
  'on-my-way-pickup': {
    currentStatus: 'on_my_way_to_pickup',
    lifecycleStatus: 'allocated',
    timestampField: 'on_my_way_at',
    eventType: 'driver_en_route',
    label: 'On my way to pickup',
    allowedLifecycle: ['awarded', 'allocated', 'accepted'],
    allowedCurrent: ['accepted'],
  },
  'arrived-pickup': {
    currentStatus: 'on_site_pickup',
    lifecycleStatus: 'allocated',
    timestampField: 'on_site_pickup_at',
    eventType: 'arrived_pickup',
    label: 'Arrived at pickup',
    allowedLifecycle: ['awarded', 'allocated', 'accepted'],
    allowedCurrent: ['on_my_way_to_pickup'],
  },
  loaded: {
    currentStatus: 'loaded',
    lifecycleStatus: 'collected',
    timestampField: 'loaded_at',
    eventType: 'collected',
    label: 'Loaded / collected',
    allowedLifecycle: ['allocated', 'accepted'],
    allowedCurrent: ['on_site_pickup'],
  },
  'on-my-way-delivery': {
    currentStatus: 'on_my_way_to_delivery',
    lifecycleStatus: 'in_transit',
    eventType: 'in_transit',
    label: 'On my way to delivery',
    allowedLifecycle: ['collected'],
    allowedCurrent: ['loaded'],
  },
  'arrived-delivery': {
    currentStatus: 'on_site_delivery',
    timestampField: 'on_site_delivery_at',
    eventType: 'arrived_delivery',
    label: 'Arrived at delivery',
    allowedLifecycle: ['in_transit'],
    allowedCurrent: ['on_my_way_to_delivery'],
  },
  delivered: {
    currentStatus: 'delivered',
    lifecycleStatus: 'delivered',
    timestampField: 'delivered_at',
    eventType: 'delivered',
    label: 'Delivered',
    allowedLifecycle: ['in_transit'],
    allowedCurrent: ['on_site_delivery'],
    requiresPod: true,
  },
};

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

  // Normalise legacy current_status aliases to their canonical equivalents so
  // that idempotency detection works on jobs written by older code paths.
  //   on_my_way   → on_my_way_to_pickup   (current_status only)
  // Note: the lifecycle status field (job.status) uses a separate set of
  // values (allocated, collected, in_transit, delivered) that do NOT need
  // normalisation — they are the raw DB lifecycle stage values used by
  // allowedLifecycle checks below.
  function normalizeCurrentStatus(value: string): string {
    const s = value.toLowerCase().trim();
    if (s === 'on_my_way') return 'on_my_way_to_pickup';
    if (s === 'in_transit') return 'on_my_way_to_delivery';
    return s;
  }

  function normalizedCurrentOrNull(value: unknown): string | null {
    const normalized = normalizeCurrentStatus(String(value ?? ''));
    return normalized || null;
  }

  // Idempotency FIRST — before lifecycle validation.
  // An offline-queue retry arrives after the transition has already been
  // applied.  At that point job.status may have advanced past the values in
  // allowedLifecycle, so the lifecycle check would return 409 instead of 200.
  // Checking current_status (the granular driver step) first prevents that.
  const currentStatus = normalizedCurrentOrNull(job.current_status);
  if (currentStatus === config.currentStatus) {
    return respond(200, { ok: true, job: mapJob(job) });
  }

  // Enforce no-skip canonical current_status transition rules.
  if (!config.allowedCurrent.includes(currentStatus)) {
    return respond(409, {
      error: `Job cannot perform ${action} from ${currentStatus ?? 'unset'} current status.`,
    });
  }

  // Lifecycle validation: only now reject disallowed transitions.
  const lifecycle = String(job.status ?? '').toLowerCase().trim();
  if (!config.allowedLifecycle.includes(lifecycle)) {
    return respond(409, { error: `Job cannot perform ${action} from ${lifecycle || 'unknown'} status.` });
  }

  if (config.requiresPod && job.pod_required !== false && !hasPod(job)) {
    return respond(409, { error: 'POD is required before marking this job delivered.' });
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    current_status: config.currentStatus,
    status_updated_at: now,
    updated_at: now,
    status_history: appendStatusHistory(job.status_history, {
      status: config.currentStatus,
      lifecycle_status: config.lifecycleStatus ?? job.status,
      label: config.label,
      timestamp: now,
      actor_user_id: driver.userId,
      source: 'driver_mobile',
    }),
  };
  if (config.lifecycleStatus) updatePayload.status = config.lifecycleStatus;
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

  // Idempotency gate: if POD evidence was already successfully saved (pod_generated
  // is true), return 200 immediately. This prevents offline-queue retries from
  // appending duplicate photos, documents or signatures to an already-complete POD.
  if (job.pod_generated === true) {
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
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .select(jobSelect)
    .single();

  if (updateError) return respond(500, { error: updateError.message });
  await insertTrackingEvent(jobId, userId, 'note', 'Persistent POD evidence uploaded');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}
