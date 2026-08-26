import { Buffer } from 'node:buffer';
import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond, safeArray } from '../../../_lib';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const SAFE_NAME = /^[A-Za-z0-9._-]{1,180}$/;

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
  if (!driver.companyId) return respond(403, { error: 'Driver company is required for POD storage.' });

  const { id } = await params;
  const kind = request.headers.get('x-xdrive-evidence-kind')?.trim().toLowerCase() ?? '';
  if (kind !== 'collection' && kind !== 'delivery') {
    return respond(400, { error: 'Unsupported evidence kind.' });
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_TYPES.has(contentType)) {
    return respond(415, { error: 'POD must be a PDF, JPEG or PNG file.' });
  }

  const objectName = request.headers.get('x-xdrive-evidence-name')?.trim() ?? '';
  if (!SAFE_NAME.test(objectName)) return respond(400, { error: 'Evidence filename is invalid.' });

  const { data: job, error: loadError } = await supabaseAdmin
    .from('jobs')
    .select('id,assigned_driver_id,delivery_photos,pod_photos,collection_photo_url')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (loadError) return respond(500, { error: loadError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const payload = Buffer.from(await request.arrayBuffer());
  if (payload.length === 0) return respond(400, { error: 'Selected POD file is empty.' });
  if (payload.length > MAX_BYTES) return respond(413, { error: 'POD file must be 10 MB or smaller.' });

  const storagePath = `${driver.companyId}/${id}/${objectName}`;
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
  } else {
    const deliveryPhotos = safeArray(job.delivery_photos).filter((value): value is string => typeof value === 'string');
    const podPhotos = safeArray(job.pod_photos).filter((value): value is string => typeof value === 'string');
    const { data: updated, error } = await supabaseAdmin
      .from('jobs')
      .update({
        delivery_photos: Array.from(new Set([...deliveryPhotos, storagePath])),
        pod_photos: Array.from(new Set([...podPhotos, storagePath])),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('assigned_driver_id', driver.driverId)
      .select('id')
      .maybeSingle();
    if (error) return respond(500, { error: error.message });
    if (!updated) return respond(409, { error: 'POD evidence could not be linked to this assignment.' });
  }

  return respond(200, { ok: true, storagePath });
}
