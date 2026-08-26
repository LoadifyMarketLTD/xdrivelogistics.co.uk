import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond, safeArray } from '../../../_lib';

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

  const evidence = [
    ...safeArray(job.pod_photos).filter((value): value is string => typeof value === 'string'),
    ...safeArray(job.delivery_photos).filter((value): value is string => typeof value === 'string'),
  ].filter(Boolean);
  const evidencePath = evidence.at(-1);
  if (!evidencePath) return respond(409, { error: 'Upload the signed POD evidence first.' });

  const now = new Date().toISOString();
  const confirmation = {
    type: 'signed_pod_evidence',
    evidence_path: evidencePath,
    recipient_name: recipientName,
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
  return respond(200, { ok: true });
}
