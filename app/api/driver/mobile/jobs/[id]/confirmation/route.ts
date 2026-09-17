import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond, safeArray } from '../../../_lib';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'pod_capture'))) return respond(503, { error: 'POD capture is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  if (!driver.companyId) return respond(403, { error: 'Driver company is required for POD confirmation.' });

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : '';
  if (!recipientName) return respond(400, { error: 'Recipient name is required.' });
  if (recipientName.length > 200) return respond(400, { error: 'Recipient name is too long.' });

  const { data: job, error: loadError } = await supabaseAdmin
    .from('jobs')
    .select('id,delivery_photos,pod_photos')
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (loadError) return respond(500, { error: loadError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const persistedEvidence = [
    ...safeArray(job.pod_photos).filter((value): value is string => typeof value === 'string'),
    ...safeArray(job.delivery_photos).filter((value): value is string => typeof value === 'string'),
  ].filter(Boolean);
  const stagedEvidencePath = typeof body.evidencePath === 'string' ? body.evidencePath.trim() : '';
  const evidencePath = stagedEvidencePath || persistedEvidence.at(-1) || '';
  if (!evidencePath) return respond(409, { error: 'Upload POD evidence first.' });

  const expectedPrefix = `${driver.companyId}/${id}/photos/`;
  if (
    !evidencePath.startsWith(expectedPrefix)
    || evidencePath.includes('://')
    || evidencePath.includes('..')
    || evidencePath.includes('\\')
    || evidencePath.startsWith('/')
  ) {
    return respond(409, { error: 'POD evidence does not belong to this driver assignment.' });
  }

  if (stagedEvidencePath) {
    const segments = evidencePath.split('/');
    const fileName = segments.pop();
    const folder = segments.join('/');
    if (!fileName || !folder) return respond(409, { error: 'POD evidence path is invalid.' });
    const { data: objects, error: storageError } = await supabaseAdmin.storage
      .from('pod-photos')
      .list(folder, { limit: 100, search: fileName });
    if (storageError) return respond(503, { error: 'POD evidence could not be verified. Please retry.' });
    if (!(objects ?? []).some((entry) => entry.name === fileName)) {
      return respond(409, { error: 'Uploaded POD evidence could not be found.' });
    }
  }

  const now = new Date().toISOString();
  const confirmation = {
    type: 'recipient_typed_name_attestation',
    signature_method: 'typed_name_attestation',
    evidence_path: evidencePath,
    recipient_name: recipientName,
    job_id: id,
    driver_id: driver.driverId,
    confirmed_at: now,
    source: 'xdrive_driver_android',
  };

  const { data: updated, error } = await supabaseAdmin
    .from('jobs')
    .update({
      client_signature_name: recipientName,
      delivery_signature_data: confirmation,
      updated_at: now,
    })
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .select('id')
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!updated) return respond(409, { error: 'Delivery evidence could not be linked to this assignment.' });
  return respond(200, { ok: true, signatureMethod: 'typed_name_attestation' });
}
