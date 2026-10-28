import { Buffer } from 'node:buffer';
import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { respond } from '../../../../mobile/_lib';
import { isWebDriverContext, requireActiveWebDriver } from '../../../../_lib/webDriverContext';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const SAFE_NAME = /^[A-Za-z0-9._-]{1,180}$/;
type EvidenceCategory = 'photos' | 'damage' | 'documents';

function hasExpectedMagicBytes(payload: Buffer, contentType: string) {
  if (contentType === 'application/pdf') return payload.subarray(0, 5).toString('ascii') === '%PDF-';
  if (contentType === 'image/jpeg') return payload.length >= 3 && payload[0] === 0xff && payload[1] === 0xd8 && payload[2] === 0xff;
  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return payload.length >= signature.length && signature.every((value, index) => payload[index] === value);
  }
  return false;
}

function evidenceCategory(request: NextRequest, kind: 'collection' | 'delivery'): EvidenceCategory | null {
  const category = request.headers.get('x-xdrive-evidence-category')?.trim().toLowerCase() ?? '';
  if (kind === 'collection') {
    if (!category || category === 'photos') return 'photos';
    return category === 'documents' ? 'documents' : null;
  }
  if (!category) return 'photos';
  return category === 'photos' || category === 'damage' || category === 'documents' ? category : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  if (!(await getFeatureFlag(supabaseAdmin, 'pod_capture'))) {
    return respond(503, { error: 'POD capture is currently disabled.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;
  if (!driver.companyId) return respond(403, { error: 'Driver company is required for POD storage.' });

  const { id } = await params;
  const kind = request.headers.get('x-xdrive-evidence-kind')?.trim().toLowerCase() ?? '';
  if (kind !== 'collection' && kind !== 'delivery') {
    return respond(400, { error: 'Unsupported evidence kind.' });
  }
  const category = evidenceCategory(request, kind);
  if (!category) {
    return respond(400, { error: 'Evidence category is not supported for this workflow.' });
  }
  const stopId = request.headers.get('x-xdrive-stop-id')?.trim() ?? '';

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_TYPES.has(contentType)) {
    return respond(415, { error: 'Evidence must be a PDF, JPEG or PNG file.' });
  }
  if ((category === 'photos' || category === 'damage') && contentType === 'application/pdf') {
    return respond(415, { error: 'Photo evidence must be a JPEG or PNG image.' });
  }

  const objectName = request.headers.get('x-xdrive-evidence-name')?.trim() ?? '';
  if (!SAFE_NAME.test(objectName)) return respond(400, { error: 'Evidence filename is invalid.' });

  const { data: job, error: loadError } = await supabaseAdmin
    .from('jobs')
    .select('id,assigned_driver_id,pickup_photos,delivery_photos,damage_photos,pod_photos')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (loadError) return respond(500, { error: loadError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const existingCollectionPhotos = Array.isArray(job.pickup_photos)
    ? job.pickup_photos.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const existingDeliveryPhotos = Array.isArray(job.delivery_photos)
    ? job.delivery_photos.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const existingDamagePhotos = Array.isArray(job.damage_photos)
    ? job.damage_photos.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const existingPodDocuments = Array.isArray(job.pod_photos)
    ? job.pod_photos.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  if (kind === 'collection' && !stopId && category === 'photos' && existingCollectionPhotos.length >= 10) {
    return respond(409, { error: 'A maximum of 10 collection photos can be attached to one job.' });
  }
  if (kind === 'delivery' && !stopId && (category === 'photos' || category === 'damage') && existingDeliveryPhotos.length + existingDamagePhotos.length >= 10) {
    return respond(409, { error: 'A maximum of 10 delivery and damage photos can be attached to one job.' });
  }
  if (kind === 'delivery' && !stopId && category === 'documents' && existingPodDocuments.length >= 10) {
    return respond(409, { error: 'A maximum of 10 POD documents can be attached to one job.' });
  }

  if (stopId) {
    const { data: stop, error: stopError } = await supabaseAdmin
      .from('job_stops')
      .select('id')
      .eq('id', stopId)
      .eq('job_id', id)
      .maybeSingle();
    if (stopError) return respond(500, { error: 'Stop evidence could not be verified.' });
    if (!stop) return respond(404, { error: 'Stop not found for this job.' });
  }

  const payload = Buffer.from(await request.arrayBuffer());
  if (payload.length === 0) return respond(400, { error: 'Selected POD file is empty.' });
  if (payload.length > MAX_BYTES) return respond(413, { error: 'POD file must be 10 MB or smaller.' });
  if (!hasExpectedMagicBytes(payload, contentType)) {
    return respond(415, { error: 'POD file content does not match its declared file type.' });
  }

  // Storage RLS scopes segment 1 to the carrier company and segment 2 to the
  // authorised job. Deeper segments preserve evidence meaning without weakening RLS.
  const folder = stopId
    ? `stops/${stopId}/${category}`
    : kind === 'collection'
      ? `collection-${category}`
      : category;
  const storagePath = `${driver.companyId}/${id}/${folder}/${objectName}`;
  const upload = await supabaseAdmin.storage
    .from('pod-photos')
    .upload(storagePath, payload, { contentType, upsert: false });

  if (upload.error) {
    const text = upload.error.message.toLowerCase();
    const duplicate = text.includes('already exists') || text.includes('duplicate');
    if (duplicate) {
      return respond(409, { error: 'An evidence file with this name already exists. Select a new filename and retry.' });
    }
    return respond(500, { error: upload.error.message });
  }

  // Job-level evidence gates the next physical lifecycle transition and is
  // linked immediately after storage verification. Stop-specific evidence and
  // collection documents remain staged for their dedicated stop/handover flow.
  if (kind === 'collection' && !stopId && category === 'photos') {
    const { data: updated, error } = await supabaseAdmin
      .from('jobs')
      .update({
        collection_photo_url: existingCollectionPhotos[0] ?? storagePath,
        pickup_photos: [...new Set([...existingCollectionPhotos, storagePath])],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('assigned_driver_id', driver.driverId)
      .select('id')
      .maybeSingle();
    if (error || !updated) {
      const cleanup = await supabaseAdmin.storage.from('pod-photos').remove([storagePath]);
      if (cleanup.error) console.error('POD evidence rollback failed:', cleanup.error.message);
      return respond(error ? 500 : 409, { error: error?.message ?? 'Collection evidence could not be linked to this assignment.' });
    }
  }

  if (kind === 'delivery' && !stopId) {
    const update = category === 'photos'
      ? { delivery_photos: [...new Set([...existingDeliveryPhotos, storagePath])], updated_at: new Date().toISOString() }
      : category === 'damage'
        ? { damage_photos: [...new Set([...existingDamagePhotos, storagePath])], updated_at: new Date().toISOString() }
        : { pod_photos: [...new Set([...existingPodDocuments, storagePath])], updated_at: new Date().toISOString() };
    const { data: updated, error } = await supabaseAdmin
      .from('jobs')
      .update(update)
      .eq('id', id)
      .eq('assigned_driver_id', driver.driverId)
      .select('id')
      .maybeSingle();
    if (error || !updated) {
      const cleanup = await supabaseAdmin.storage.from('pod-photos').remove([storagePath]);
      if (cleanup.error) console.error('POD evidence rollback failed:', cleanup.error.message);
      return respond(error ? 500 : 409, { error: error?.message ?? 'Delivery evidence could not be linked to this assignment.' });
    }
  }

  return respond(200, { ok: true, storagePath });
}
