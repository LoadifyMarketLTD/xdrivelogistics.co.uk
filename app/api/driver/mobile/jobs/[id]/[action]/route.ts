import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { autoGenerateMarketplaceInvoice } from '../../../../../_lib/autoGenerateMarketplaceInvoice';
import { assertCanonicalPodReady, isCanonicalPodPath, saveCanonicalPod } from '../../../../../_lib/pod';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import {
  appendStatusHistory,
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
  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id, action } = await params;
  if (action === 'pod') {
    const podEnabled = await getFeatureFlag(supabaseAdmin, 'pod_capture');
    if (!podEnabled) return respond(503, { error: 'POD capture is currently disabled.' });
    return savePod(request, id, driver.userId, driver.driverId, driver.driverType);
  }

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

  if (config.requiresPod) {
    try {
      const podReady = await assertCanonicalPodReady(supabaseAdmin, id);
      if (!podReady.ok) return respond(409, { error: podReady.reason });
    } catch (reason) {
      return respond(503, {
        error: reason instanceof Error
          ? `POD validation failed: ${reason.message}`
          : 'POD validation failed.',
      });
    }
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

async function savePod(
  request: NextRequest,
  jobId: string,
  userId: string,
  driverId: string,
  driverType: string | null,
) {
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
  if (rawSignature.length > 3_500_000) {
    return respond(413, { error: 'Recipient signature is too large.' });
  }

  const photoPaths = rawPhotoUris.filter((value): value is string => isCanonicalPodPath(jobId, 'photos', value));
  const documentPaths = rawDocumentUris.filter((value): value is string => isCanonicalPodPath(jobId, 'documents', value));
  if (photoPaths.length !== rawPhotoUris.length || documentPaths.length !== rawDocumentUris.length) {
    return respond(400, { error: 'POD files must be uploaded to XDrive storage before submission.' });
  }

  const executingCompanyId = job.awarded_carrier_company_id || job.assigned_company_id || job.company_id;
  if (!executingCompanyId) return respond(409, { error: 'Executing company could not be resolved for this job.' });

  try {
    await saveCanonicalPod({
      supabase: supabaseAdmin!,
      jobId,
      companyId: executingCompanyId,
      assignedDriverId: driverId,
      vehicleRef: job.vehicle_ref,
      actorUserId: userId,
      actorRole: driverType === 'owner_driver' ? 'owner_driver' : 'driver',
      source: driverType === 'owner_driver' ? 'owner_driver' : 'driver_mobile',
      onBehalfOfDriverId: null,
      reason: null,
      recipientName,
      signatureData: rawSignature || null,
      photoPaths,
      documentPaths,
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 5000) : null,
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'POD could not be saved.';
    const status = /too large/i.test(message) ? 413 : /storage|upload/i.test(message) ? 503 : 400;
    return respond(status, { error: message });
  }

  const { data: updated, error: refreshError } = await supabaseAdmin!
    .from('jobs')
    .select(jobSelect)
    .eq('id', jobId)
    .eq('assigned_driver_id', driverId)
    .single();

  if (refreshError) return respond(500, { error: refreshError.message });
  await insertTrackingEvent(jobId, userId, 'note', 'Canonical POD evidence saved');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}
