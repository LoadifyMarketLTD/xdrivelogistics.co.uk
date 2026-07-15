import { NextRequest } from 'next/server';
import {
  appendStatusHistory,
  hasPod,
  MobileDbClient,
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
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id, action } = await params;
  if (action === 'pod') return savePod(request, id, driver.userId, driver.driverId, driver.db);

  const { data: existing, error: loadError } = await driver.db
    .from('jobs')
    .select(jobSelect)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();

  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Job not found.' });

  const job = existing as unknown as MobileJobRow;
  const lifecycle = String(job.status ?? '').toLowerCase();
  const currentStatus = String(job.current_status ?? '').toLowerCase();

  if (action === 'accept-assignment') {
    return acceptAssignment(job, id, driver.userId, driver.driverId, driver.db);
  }
  if (action === 'reject-assignment') {
    return rejectAssignment(job, id, driver.userId, driver.driverId, driver.db);
  }

  const config = actions[action];
  if (!config) return respond(404, { error: 'Unsupported driver action.' });

  const assignmentDecisionRequired = ['awarded', 'allocated'].includes(lifecycle)
    && ['awarded', 'allocated', 'driver_pending_acceptance'].includes(currentStatus || lifecycle);
  if (assignmentDecisionRequired) {
    return respond(409, { error: 'Accept or reject this assignment before updating trip progress.' });
  }

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

  const { data: updated, error: updateError } = await driver.db
    .from('jobs')
    .update(updatePayload)
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .select(jobSelect)
    .single();

  if (updateError) return respond(500, { error: updateError.message });
  await insertTrackingEvent(driver.db, id, driver.userId, config.eventType, config.label);

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}

async function acceptAssignment(job: MobileJobRow, jobId: string, userId: string, driverId: string, db: MobileDbClient) {
  const lifecycle = String(job.status ?? '').toLowerCase();
  if (!['awarded', 'allocated'].includes(lifecycle)) {
    return respond(409, { error: `Job cannot accept assignment from ${lifecycle || 'unknown'} status.` });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from('jobs')
    .update({
      status: 'allocated',
      current_status: 'driver_confirmed',
      status_updated_at: now,
      updated_at: now,
      status_history: appendStatusHistory(job.status_history, {
        status: 'driver_confirmed',
        lifecycle_status: 'allocated',
        label: 'Driver accepted assignment',
        timestamp: now,
        actor_user_id: userId,
        source: 'driver_mobile',
      }),
    })
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .select(jobSelect)
    .single();

  if (error) return respond(500, { error: error.message });
  await insertTrackingEvent(db, jobId, userId, 'note', 'Driver accepted assignment');
  await insertAssignmentDecisionNotification(db, job, userId, driverId, 'driver_assignment_accepted', 'allocated');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}

async function rejectAssignment(job: MobileJobRow, jobId: string, userId: string, driverId: string, db: MobileDbClient) {
  const lifecycle = String(job.status ?? '').toLowerCase();
  if (!['awarded', 'allocated'].includes(lifecycle)) {
    return respond(409, { error: `Job cannot reject assignment from ${lifecycle || 'unknown'} status.` });
  }

  const fallbackLifecycle = job.awarded_carrier_company_id ? 'awarded' : 'posted';
  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from('jobs')
    .update({
      assigned_driver_id: null,
      assigned_company_id: job.awarded_carrier_company_id ?? null,
      status: fallbackLifecycle,
      current_status: fallbackLifecycle,
      status_updated_at: now,
      updated_at: now,
      status_history: appendStatusHistory(job.status_history, {
        status: 'driver_rejected',
        lifecycle_status: fallbackLifecycle,
        label: 'Driver rejected assignment',
        timestamp: now,
        actor_user_id: userId,
        source: 'driver_mobile',
      }),
    })
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .select(jobSelect)
    .single();

  if (error) return respond(500, { error: error.message });
  await insertTrackingEvent(db, jobId, userId, 'note', 'Driver rejected assignment');
  await insertAssignmentDecisionNotification(db, job, userId, driverId, 'driver_assignment_rejected', fallbackLifecycle);

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}

async function insertAssignmentDecisionNotification(
  db: MobileDbClient,
  job: MobileJobRow,
  userId: string,
  driverId: string,
  eventType: string,
  lifecycleAfter: string,
) {
  await db.from('notification_events').insert({
    event_type: eventType,
    entity_type: 'job',
    entity_id: job.id,
    company_id: job.awarded_carrier_company_id ?? job.company_id,
    payload: {
      job_id: job.id,
      driver_id: driverId,
      actor_user_id: userId,
      lifecycle_before: job.status,
      lifecycle_after: lifecycleAfter,
      pickup_location: job.pickup_location,
      delivery_location: job.delivery_location,
    },
  });
}

async function savePod(request: NextRequest, jobId: string, userId: string, driverId: string, db: MobileDbClient) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const { data: existing, error: loadError } = await db
    .from('jobs')
    .select(jobSelect)
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .maybeSingle();

  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Job not found.' });

  const job = existing as unknown as MobileJobRow;
  const now = new Date().toISOString();
  const photos = safeArray(job.delivery_photos).filter((item): item is string => typeof item === 'string');
  const podPhotos = safeArray(job.pod_photos).filter((item): item is string => typeof item === 'string');
  const photoUris = safeArray(body.photoUris).filter((item): item is string => typeof item === 'string' && item.length > 0);
  const documentUris = safeArray(body.documentUris).filter((item): item is string => typeof item === 'string' && item.length > 0);
  const signatureData = typeof body.signatureData === 'string' && body.signatureData.trim()
    ? { type: 'driver_mobile_signature', value: body.signatureData.trim(), captured_at: now, captured_by: userId }
    : job.delivery_signature_data ?? null;

  const { data: updated, error: updateError } = await db
    .from('jobs')
    .update({
      delivery_photos: [...photos, ...photoUris],
      pod_photos: [...podPhotos, ...documentUris],
      delivery_signature_data: signatureData,
      client_signature_name: typeof body.recipientName === 'string' && body.recipientName.trim() ? body.recipientName.trim() : null,
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
  await insertTrackingEvent(db, jobId, userId, 'delivered', 'POD metadata uploaded');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}
