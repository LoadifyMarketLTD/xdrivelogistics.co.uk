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

  const itemCount = optionalNumber(body.itemCount, 0, 100000);
  const weightKg = optionalNumber(body.weightKg, 0, 100000);
  const etaMinutes = optionalNumber(body.etaMinutes, 0, 1440);
  if ([itemCount, weightKg, etaMinutes].some((value) => Number.isNaN(value))) {
    return respond(400, { error: 'Item count, weight and ETA must be valid positive numbers.' });
  }
  const packaging = cleanString(body.packaging, 120);
  const notes = cleanString(body.notes, 2000);
  const photoPaths = stringPaths(body.photoPaths, MAX_PHOTOS);
  const documentPaths = stringPaths(body.documentPaths, MAX_DOCUMENTS);
  if (photoPaths.length === 0) {
    return respond(400, { error: 'At least one collection photo is required.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, status, current_status, pickup_photos')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Assigned job could not be resolved.' });
  if (!job) return respond(404, { error: 'Job not found.' });

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
  const handover = {
    version: 1,
    capturedAt,
    itemCount,
    packaging: packaging || null,
    weightKg,
    etaMinutes,
    notes: notes || null,
    photoPaths,
    documentPaths,
  };
  const existingPhotos = Array.isArray(job.pickup_photos)
    ? job.pickup_photos.filter((value): value is string => typeof value === 'string')
    : [];
  const update: Record<string, unknown> = {
    collection_handover: handover,
    collection_photo_url: photoPaths[0],
    pickup_photos: [...new Set([...existingPhotos, ...photoPaths])],
    updated_at: capturedAt,
  };
  if (itemCount !== null) update.no_of_items = Math.round(itemCount);
  if (packaging) update.packaging = packaging;
  if (weightKg !== null) update.weight_kg = weightKg;
  if (notes) update.collection_notes = notes;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(update)
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
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
