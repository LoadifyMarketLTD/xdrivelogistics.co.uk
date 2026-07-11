import path from 'path';
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

const POD_BUCKET = 'pod-docs';
const MAX_POD_UPLOAD_BYTES = 15 * 1024 * 1024;
const allowedPodMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

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
  await insertTrackingEvent(id, driver.userId, config.eventType, config.label);

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}

async function savePod(request: NextRequest, jobId: string, userId: string, driverId: string) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  let body: Record<string, unknown> = {};
  let photoFiles: File[] = [];
  let documentFiles: File[] = [];
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    photoFiles = formData.getAll('photos').filter((value): value is File => value instanceof File);
    documentFiles = formData.getAll('documents').filter((value): value is File => value instanceof File);
    body = {
      recipientName: String(formData.get('recipientName') ?? ''),
      signatureData: String(formData.get('signatureData') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    };
  } else {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return respond(400, { error: 'Invalid JSON body.' });
    }
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
  const now = new Date().toISOString();
  const photos = safeArray(job.delivery_photos).filter((item): item is string => typeof item === 'string');
  const podPhotos = safeArray(job.pod_photos).filter((item): item is string => typeof item === 'string');
  const photoUris = safeArray(body.photoUris).filter(
    (item): item is string => typeof item === 'string' && item.length > 0 && !item.startsWith('file://')
  );
  const documentUris = safeArray(body.documentUris).filter(
    (item): item is string => typeof item === 'string' && item.length > 0 && !item.startsWith('file://')
  );
  const uploadedMedia = await uploadPodFiles(jobId, photoFiles, documentFiles, now);
  if ('error' in uploadedMedia) return respond(uploadedMedia.status, { error: uploadedMedia.error });
  const signatureData = typeof body.signatureData === 'string' && body.signatureData.trim()
    ? { type: 'driver_mobile_signature', value: body.signatureData.trim(), captured_at: now, captured_by: userId }
    : job.delivery_signature_data ?? null;

  const { data: updated, error: updateError } = await supabaseAdmin!
    .from('jobs')
    .update({
      delivery_photos: [...photos, ...photoUris, ...uploadedMedia.photoPaths],
      pod_photos: [...podPhotos, ...documentUris, ...uploadedMedia.documentPaths],
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

  if (updateError) {
    await cleanupPodFiles(uploadedMedia.uploadedPaths);
    return respond(500, { error: updateError.message });
  }
  await insertTrackingEvent(jobId, userId, 'delivered', 'POD metadata uploaded');

  return respond(200, { ok: true, job: mapJob(updated as unknown as MobileJobRow) });
}

async function uploadPodFiles(jobId: string, photoFiles: File[], documentFiles: File[], nowIso: string) {
  const uploadedPaths: string[] = [];
  const photoPaths: string[] = [];
  const documentPaths: string[] = [];
  const timestamp = Date.parse(nowIso) || Date.now();
  const allFiles = [
    ...photoFiles.map((file, index) => ({ file, kind: 'photo' as const, index })),
    ...documentFiles.map((file, index) => ({ file, kind: 'document' as const, index })),
  ];

  for (const { file, kind, index } of allFiles) {
    if (file.size <= 0 || file.size > MAX_POD_UPLOAD_BYTES) {
      await cleanupPodFiles(uploadedPaths);
      return { status: 413, error: 'POD files must be between 1 byte and 15MB.' };
    }
    const fileMime = (file.type || '').toLowerCase();
    if (fileMime && !allowedPodMimeTypes.has(fileMime)) {
      await cleanupPodFiles(uploadedPaths);
      return { status: 415, error: `Unsupported POD file type: ${file.type || 'unknown'}.` };
    }

    const extension = path.extname(file.name || '').toLowerCase() || (kind === 'photo' ? '.jpg' : '.bin');
    const baseName = sanitizeFilename(path.basename(file.name || `${kind}-${index + 1}${extension}`, extension));
    const objectPath = `jobs/${jobId}/driver-mobile/${timestamp}-${kind}-${index + 1}-${baseName}${extension}`;
    const bytes = await file.arrayBuffer();
    const { error } = await supabaseAdmin!.storage.from(POD_BUCKET).upload(objectPath, bytes, {
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      await cleanupPodFiles(uploadedPaths);
      return { status: 500, error: error.message };
    }

    uploadedPaths.push(objectPath);
    if (kind === 'photo') photoPaths.push(objectPath);
    else documentPaths.push(objectPath);
  }

  return { uploadedPaths, photoPaths, documentPaths };
}

async function cleanupPodFiles(paths: string[]) {
  if (!paths.length || !supabaseAdmin) return;
  const { error } = await supabaseAdmin.storage.from(POD_BUCKET).remove(paths);
  if (error) {
    console.error('[mobile-pod] failed cleanup after upload error', { paths, error: error.message });
  }
}
