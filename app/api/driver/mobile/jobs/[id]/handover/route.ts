import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { insertTrackingEvent, isDriverContext, requireDriver, respond } from '../../../_lib';
import { collectionReferenceIdentity, verifiedCollectionCommercialActorId } from '../../../../../../../lib/jobs/collectionReferenceIdentity';

const MAX_PHOTOS = 10;
const MAX_DOCUMENTS = 10;

/** One authoritative commercial actor per collection; driver login remains individually auditable. */
async function getCollectionIdentity(
  jobId: string,
  companyId: string,
  userId: string,
  driverType: string | null,
) {
  const ownerDriver = driverType === 'owner_driver';
  const [{ data: company, error: companyError }, ownerProfile] = await Promise.all([
    supabaseAdmin!.from('companies').select('xd_id, company_type').eq('id', companyId).maybeSingle(),
    ownerDriver
      ? supabaseAdmin!.from('profiles').select('xd_id').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (companyError || ownerProfile.error || !company) {
    return { error: 'Transport operator identity could not be verified.', identity: null };
  }
  if (ownerDriver && !['owner_driver', 'sole_trader'].includes(String(company.company_type ?? ''))) {
    return { error: 'Owner Driver must operate through their verified personal workspace.', identity: null };
  }
  const publicId = verifiedCollectionCommercialActorId(driverType, company.xd_id, ownerProfile.data?.xd_id);
  if (!publicId) {
    return { error: ownerDriver
      ? 'Owner Driver XDrive IDs are inconsistent. Collection is blocked until identity reconciliation.'
      : 'Driver role or employing company XDrive ID is not verified.', identity: null };
  }
  const identity = collectionReferenceIdentity(jobId, publicId);
  return identity
    ? { error: null, identity }
    : { error: 'Official job reference or transport operator ID could not be verified.', identity: null };
}

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

  const stage = body.stage === 'arrival' ? 'arrival' : 'loaded';
  const itemCount = optionalNumber(body.itemCount, 1, 100000);
  const weightKg = optionalNumber(body.weightKg, 0.000001, 100000);
  const etaProvided = typeof body.etaAt === 'string' && body.etaAt.trim().length > 0;
  const etaDate = etaProvided ? new Date(String(body.etaAt)) : null;
  const etaAt = etaDate && Number.isFinite(etaDate.getTime()) ? etaDate.toISOString() : null;
  if ([itemCount, weightKg].some((value) => Number.isNaN(value))) {
    return respond(400, { error: 'Item count and weight must be valid positive numbers when supplied.' });
  }
  if (etaProvided && !etaAt) {
    return respond(400, { error: 'ETA must be a valid date and time when supplied.' });
  }
  if (etaDate && Number.isFinite(etaDate.getTime()) && etaDate.getTime() <= Date.now()) {
    return respond(400, { error: 'Delivery ETA must be in the future.' });
  }
  const packaging = cleanString(body.packaging, 120);
  const notes = cleanString(body.notes, 2000);
  const photoPaths = stringPaths(body.photoPaths, MAX_PHOTOS);
  const documentPaths = stringPaths(body.documentPaths, MAX_DOCUMENTS);

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, assigned_company_id, status, current_status, customer_reference, customer_ref, pickup_photos, collection_handover')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (jobError) return respond(500, { error: 'Assigned job could not be resolved.' });
  if (!job) return respond(404, { error: 'Job not found.' });
  if (job.assigned_company_id && job.assigned_company_id !== driver.companyId) {
    return respond(403, { error: 'This job belongs to another carrier company.' });
  }
  const references = stage === 'loaded' ? await getCollectionIdentity(jobId, driver.companyId, driver.userId, driver.driverType) : null;
  if (references?.error || (stage === 'loaded' && !references?.identity)) {
    return respond(409, { error: references?.error || 'Collection identifiers are not available.' });
  }

  const rawStatus = String(job.current_status || job.status || '').toLowerCase();
  const status = rawStatus === 'arrived_pickup' ? 'on_site_pickup' : rawStatus;
  if (stage === 'arrival' && status !== 'on_site_pickup') return respond(409, { error: 'Collection arrival is available only after arriving at collection.' });
  if (stage === 'loaded' && !['on_site_pickup','loaded'].includes(status)) return respond(409, { error: 'Loaded information is available only after arriving at collection.' });

  const companyPrefix = `${driver.companyId}/${jobId}/`;
  const photosValid = await verifyStoragePaths(photoPaths, [
    `${companyPrefix}collection-photos/`,
    `${companyPrefix}collection/`,
  ]);
  if (!photosValid) {
    return respond(400, { error: 'Collection photo evidence could not be verified.' });
  }
  if (stage === 'loaded' && photoPaths.length === 0) return respond(400, { error: 'At least one collection/loading photo is required.' });
  const documentsValid = await verifyStoragePaths(documentPaths, [
    `${companyPrefix}collection-documents/`,
  ]);
  if (!documentsValid) {
    return respond(400, { error: 'Collection document evidence could not be verified.' });
  }

  const capturedAt = new Date().toISOString();
  const previousHandover = job.collection_handover && typeof job.collection_handover === 'object' && !Array.isArray(job.collection_handover) ? job.collection_handover as Record<string, unknown> : {};
  const stageRecord = stage === 'arrival'
    ? { version: 1, capturedAt, itemCount, weightKg, notes: notes || null, photoPaths, documentPaths }
    : {
        version: 1, capturedAt, itemCount,
        // Legacy names remain for compatibility; the carrier company ID is
        // NOT stored as customerReference, which belongs to the posting client.
        yourReference: references!.identity!.jobReference,
        customerReference: cleanString(job.customer_reference || job.customer_ref, 120) ||
          cleanString(previousHandover.customerReference, 120) || null,
        jobReference: references!.identity!.jobReference,
        carrierCompanyReference: references!.identity!.carrierCompanyReference,
        packaging: packaging || null, weightKg, etaAt, notes: notes || null, photoPaths, documentPaths,
      };
  const handover = stage === 'arrival'
    ? { ...previousHandover, arrival: stageRecord }
    : { ...previousHandover, ...stageRecord, loaded: stageRecord };
  const existingPhotos = Array.isArray(job.pickup_photos)
    ? job.pickup_photos.filter((value): value is string => typeof value === 'string')
    : [];
  const update: Record<string, unknown> = {
    collection_handover: handover,
    ...(photoPaths.length ? { collection_photo_url: photoPaths[0] } : {}),
    pickup_photos: [...new Set([...existingPhotos, ...photoPaths])],
    updated_at: capturedAt,
  };
  if (stage === 'loaded') {
    if (itemCount !== null) update.no_of_items = itemCount;
    if (packaging) update.packaging = packaging;
    if (weightKg !== null) update.weight_kg = weightKg;
    if (notes) update.collection_notes = notes;
  }

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
    stage === 'arrival' ? 'collection_arrival' : 'collection_handover',
    stage === 'arrival' ? 'Arrived at collection; arrival evidence recorded.' : 'Loaded information recorded.',
  ).catch(() => undefined);

  return respond(200, { ok: true, handover: updated.collection_handover });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  const { id: jobId } = await params;
  const { data, error } = await supabaseAdmin.from('jobs')
.select('id, collection_handover, assigned_company_id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (error) return respond(500, { error: 'Collection workflow could not be read.' });
  if (!data) return respond(404, { error: 'Job not found.' });
  if (!driver.companyId || (data.assigned_company_id && data.assigned_company_id !== driver.companyId)) {
    return respond(403, { error: 'Assigned carrier company could not be verified.' });
  }
  const references = await getCollectionIdentity(jobId, driver.companyId, driver.userId, driver.driverType);
  if (references.error || !references.identity) {
    return respond(409, { error: references.error || 'Collection identifiers are not available.' });
  }
  return respond(200, { ok: true, handover: data.collection_handover ?? null, references: references.identity });
}
