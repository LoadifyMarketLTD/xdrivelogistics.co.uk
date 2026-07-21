import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
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
  requiresPod?: boolean;
};

const actions: Record<string, ActionConfig> = {
  'on-my-way-pickup': {
    currentStatus: 'on_my_way',
    lifecycleStatus: 'allocated',
    timestampField: 'on_my_way_at',
    eventType: 'driver_en_route',
    label: 'On my way to pickup',
    allowedLifecycle: ['awarded', 'allocated'],
  },
  'arrived-pickup': {
    currentStatus: 'on_site_pickup',
    lifecycleStatus: 'allocated',
    timestampField: 'on_site_pickup_at',
    eventType: 'arrived_pickup',
    label: 'Arrived at pickup',
    allowedLifecycle: ['awarded', 'allocated'],
  },
  loaded: {
    currentStatus: 'loaded',
    lifecycleStatus: 'collected',
    timestampField: 'loaded_at',
    eventType: 'collected',
    label: 'Loaded / collected',
    allowedLifecycle: ['allocated'],
  },
  'on-my-way-delivery': {
    currentStatus: 'in_transit',
    lifecycleStatus: 'in_transit',
    eventType: 'in_transit',
    label: 'On my way to delivery',
    allowedLifecycle: ['collected'],
  },
  'arrived-delivery': {
    currentStatus: 'on_site_delivery',
    timestampField: 'on_site_delivery_at',
    eventType: 'arrived_delivery',
    label: 'Arrived at delivery',
    allowedLifecycle: ['in_transit'],
  },
  delivered: {
    currentStatus: 'delivered',
    lifecycleStatus: 'delivered',
    timestampField: 'delivered_at',
    eventType: 'delivered',
    label: 'Delivered',
    allowedLifecycle: ['in_transit'],
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
  const lifecycle = String(job.status ?? '').toLowerCase();
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
  try {
    await insertTrackingEvent(id, driver.userId, config.eventType, config.label);
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : 'Failed to record tracking event.' });
  }

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}

const persistentPodPath = (jobId: string, value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  return path.length > 0 && !path.includes('://') && path.startsWith(`${jobId}/`);
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
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  const rawSignature = typeof body.signatureData === 'string' ? body.signatureData.trim() : '';
  const photoPaths = safeArray(body.photoUris).filter((value) => persistentPodPath(jobId, value));
  const documentPaths = safeArray(body.documentUris).filter((value) => persistentPodPath(jobId, value));

  const suppliedEvidenceCount = safeArray(body.photoUris).length + safeArray(body.documentUris).length;
  if (photoPaths.length + documentPaths.length !== suppliedEvidenceCount) {
    return respond(400, { error: 'POD files must be uploaded to XDrive storage before submission.' });
  }
  if (!recipientName) return respond(400, { error: 'Recipient name is required for POD.' });
  if (!rawSignature) return respond(400, { error: 'Recipient signature is required for POD.' });
  if (photoPaths.length + documentPaths.length === 0) {
    return respond(400, { error: 'At least one POD photo or document is required.' });
  }

  const now = new Date().toISOString();
  const existingPhotos = safeArray(job.delivery_photos).filter((item): item is string => typeof item === 'string');
  const existingDocuments = safeArray(job.pod_photos).filter((item): item is string => typeof item === 'string');

  const { data: updated, error: updateError } = await supabaseAdmin!
    .from('jobs')
    .update({
      delivery_photos: [...existingPhotos, ...photoPaths],
      pod_photos: [...existingDocuments, ...documentPaths],
      delivery_signature_data: rawSignature,
      client_signature_name: recipientName,
      delivery_notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
      pod_generated: true,
      pod_generated_at: now,
      updated_at: now,
    })
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .select(jobSelect)
    .single();

  if (updateError) return respond(500, { error: updateError.message });
  try {
    await insertTrackingEvent(jobId, userId, 'note', 'POD evidence uploaded');
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : 'Failed to record POD tracking event.' });
  }

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}
