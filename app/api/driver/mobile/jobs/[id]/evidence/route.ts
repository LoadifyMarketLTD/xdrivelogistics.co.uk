import { Buffer } from 'node:buffer';
import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond } from '../../../_lib';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const SAFE_NAME = /^[A-Za-z0-9._-]{1,180}$/;
type DeliveryEvidenceCategory = 'photos' | 'damage' | 'documents';

function hasExpectedMagicBytes(payload: Buffer, contentType: string) {
  if (contentType === 'application/pdf') return payload.subarray(0, 5).toString('ascii') === '%PDF-';
  if (contentType === 'image/jpeg') {
    return payload.length >= 3 && payload[0] === 0xff && payload[1] === 0xd8 && payload[2] === 0xff;
  }
  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return payload.length >= signature.length && signature.every((value, index) => payload[index] === value);
  }
  return false;
}

function deliveryEvidenceCategory(request: NextRequest): DeliveryEvidenceCategory | null {
  const category = request.headers.get('x-xdrive-evidence-category')?.trim().toLowerCase() ?? '';
  return category === 'photos' || category === 'damage' || category === 'documents' ? category : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) {
    return respond(503, { error: 'The driver mobile app is currently disabled.' });
  }
  if (!(await getFeatureFlag(supabaseAdmin, 'pod_capture'))) {
    return respond(503, { error: 'POD capture is currently disabled.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const kind = request.headers.get('x-xdrive-evidence-kind')?.trim().toLowerCase() ?? '';
  if (kind !== 'collection' && kind !== 'delivery') {
    return respond(400, { error: 'Unsupported evidence kind.' });
  }

  const category = kind === 'delivery' ? deliveryEvidenceCategory(request) : 'collection';
  if (!category) {
    return respond(400, { error: 'Delivery evidence category must be photos, damage or documents.' });
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_TYPES.has(contentType)) {
    return respond(415, { error: 'Evidence must be a PDF, JPEG or PNG file.' });
  }
  if ((category === 'photos' || category === 'damage' || category === 'collection') && contentType === 'application/pdf') {
    return respond(415, { error: 'Photo evidence must be a JPEG or PNG image.' });
  }

  const objectName = request.headers.get('x-xdrive-evidence-name')?.trim() ?? '';
  if (!SAFE_NAME.test(objectName)) return respond(400, { error: 'Evidence filename is invalid.' });

  const { data: job, error: loadError } = await supabaseAdmin
    .from('jobs')
    .select('id,assigned_driver_id')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (loadError) return respond(500, { error: loadError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const payload = Buffer.from(await request.arrayBuffer());
  if (payload.length === 0) return respond(400, { error: 'Selected evidence file is empty.' });
  if (payload.length > MAX_BYTES) return respond(413, { error: 'Evidence file must be 10 MB or smaller.' });
  if (!hasExpectedMagicBytes(payload, contentType)) {
    return respond(415, { error: 'Evidence file content does not match its declared file type.' });
  }

  const storagePath = `${driver.companyId}/${id}/${category}/${objectName}`;
  const upload = await supabaseAdmin.storage
    .from('pod-photos')
    .upload(storagePath, payload, { contentType, upsert: false });

  if (upload.error) {
    const text = upload.error.message.toLowerCase();
    const duplicate = text.includes('already exists') || text.includes('duplicate');
    if (!duplicate) return respond(500, { error: upload.error.message });
  }

  if (kind === 'collection') {
    const { data: updated, error } = await supabaseAdmin
      .from('jobs')
      .update({ collection_photo_url: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('assigned_driver_id', driver.driverId)
      .select('id')
      .maybeSingle();
    if (error) return respond(500, { error: error.message });
    if (!updated) return respond(409, { error: 'Collection evidence could not be linked to this assignment.' });
  }

  return respond(200, { ok: true, storagePath });
}
