import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';

const MAX_PHOTOS = 10;
const MAX_DOCUMENTS = 10;

function cleanString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function optionalNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : NaN;
}

function stringPaths(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

async function verifyStoragePaths(paths: string[], prefixes: string[]) {
  for (const path of paths) {
    if (!prefixes.some((prefix) => path.startsWith(prefix))) return false;
    const splitAt = path.lastIndexOf('/');
    if (splitAt <= 0 || splitAt === path.length - 1) return false;
    const folder = path.slice(0, splitAt);
    const fileName = path.slice(splitAt + 1);
    const { data, error } = await supabaseAdmin!.storage
      .from('pod-photos')
      .list(folder, { limit: 100, search: fileName });
    if (error || !(data ?? []).some((entry) => entry.name === fileName)) return false;
  }
  return true;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id } = await params;
  const { data, error } = await supabaseAdmin.from('jobs').select('collection_handover').eq('id', id).eq('assigned_driver_id', driver.driverId).eq('assigned_company_id', driver.companyId).maybeSingle();
  if (error) return respond(503, { error: 'Collection stage could not be read.' });
  if (!data) return respond(404, { error: 'Job not found.' });
  return respond(200, { handover: data.collection_handover ?? null });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  if (!driver.companyId) {
    return respond(403, { error: 'Driver company is required for collection handover.' });
  }

  const { id: jobId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const stage = body.stage == null ? 'loaded' : body.stage;
  if (stage !== 'arrival' && stage !== 'loaded') return respond(400, { error: 'Unsupported collection stage.' });
  const itemCount = optionalNumber(body.itemCount, 0, 100000);
  const weightKg = optionalNumber(body.weightKg, 0, 100000);
  const etaMinutes = optionalNumber(body.etaMinutes, 0, 1440);
  if ([itemCount, weightKg, etaMinutes].some((value) => Number.isNaN(value))) {
    return respond(400, { error: 'Item count, weight and ETA must be valid positive numbers.' });
  }
  if (itemCount !== null && (!Number.isInteger(itemCount) || itemCount <= 0)) return respond(400, { error: 'Item count must be a positive whole number.' });
  if (weightKg !== null && weightKg <= 0) return respond(400, { error: 'Weight must be positive.' });
  const packaging = cleanString(body.packaging, 120);
  const notes = cleanString(body.notes, 2000);
  const photoPaths = stringPaths(body.photoPaths, MAX_PHOTOS);
  const documentPaths = stringPaths(body.documentPaths, MAX_DOCUMENTS);

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, status, current_status, pickup_photos, collection_handover, assigned_company_id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Assigned job could not be resolved.' });
  if (!job) return respond(404, { error: 'Job not found.' });

  if (job.assigned_company_id !== driver.companyId) return respond(403, { error: 'Job belongs to another carrier.' });
  const rawStatus = String(job.current_status || job.status || '').toLowerCase();
  const status = rawStatus === 'arrived_pickup' ? 'on_site_pickup' : rawStatus;
  if (!['on_site_pickup', 'loaded'].includes(status)) {
    return respond(409, { error: 'Collection handover is available only after arriving at collection.' });
  }

  const companyPrefix = `${driver.companyId}/${jobId}/`;
  const photosValid = await verifyStoragePaths(photoPaths, [
    `${companyPrefix}collection-photos/`,
    `${companyPrefix}collection/`,
  ]);
  if (!photosValid) {
    return respond(400, { error: 'Collection photo evidence could not be verified.' });
  }
  const documentsValid = await verifyStoragePaths(documentPaths, [
    `${companyPrefix}collection-documents/`,
  ]);
  if (!documentsValid) {
    return respond(400, { error: 'Collection document evidence could not be verified.' });
  }

  const capturedAt = new Date().toISOString();
  const previous = job.collection_handover && typeof job.collection_handover === 'object' && !Array.isArray(job.collection_handover) ? job.collection_handover as Record<string, unknown> : {};
  if (stage === 'arrival' && (status === 'loaded' || previous.loaded)) return respond(409, { error: 'Collection already loaded.' });
  const etaAt = typeof body.etaAt === 'string' && body.etaAt.trim() ? new Date(body.etaAt) : null;
  if (etaAt && (!Number.isFinite(etaAt.getTime()) || etaAt.getTime() <= Date.now())) return respond(400, { error: 'Delivery ETA must be in the future.' });
  const stageData = {
    version: 1,
    capturedAt,
    itemCount,
    packaging: packaging || null,
    weightKg,
    etaMinutes,
    etaAt: etaAt?.toISOString() ?? null,
    notes: notes || null,
    photoPaths,
    documentPaths,
  };
  const handover = { ...previous, ...(stage === 'loaded' ? stageData : {}), [stage]: stageData };
  const existingPhotos = Array.isArray(job.pickup_photos)
    ? job.pickup_photos.filter((value): value is string => typeof value === 'string')
    : [];
  const update: Record<string, unknown> = {
    collection_handover: handover,
    ...(photoPaths.length ? { collection_photo_url: photoPaths[0] } : {}),
    pickup_photos: [...new Set([...existingPhotos, ...photoPaths])],
    updated_at: capturedAt,
  };
  if (stage === 'loaded' && itemCount !== null) update.no_of_items = Math.round(itemCount);
  if (stage === 'loaded' && packaging) update.packaging = packaging;
  if (stage === 'loaded' && weightKg !== null) update.weight_kg = weightKg;
  if (notes) update.collection_notes = notes;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(update)
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .eq('assigned_company_id', driver.companyId)
    .eq('current_status', job.current_status)
    .select('id, collection_handover')
    .maybeSingle();
  if (updateError) {
    return respond(500, { error: 'Collection handover could not be saved.' });
  }
  if (!updated) {
    return respond(409, { error: 'Collection handover could not be linked to this assignment.' });
  }

  await insertTrackingEvent(
    jobId,
    driver.userId,
    'collection_handover',
    'Collection handover recorded.',
  ).catch(() => undefined);

  return respond(200, { ok: true, handover: updated.collection_handover });
}
