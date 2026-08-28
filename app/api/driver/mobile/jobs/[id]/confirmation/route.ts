import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond, safeArray } from '../../../_lib';

const DELIVERY_STATUSES = new Set(['completed', 'partial', 'refused', 'left_safe']);

function stringField(body: Record<string, unknown>, key: string, max: number) {
  const value = typeof body[key] === 'string' ? body[key].trim() : '';
  return value.slice(0, max);
}

function optionalNumber(body: Record<string, unknown>, key: string, min: number, max: number) {
  if (body[key] == null || body[key] === '') return null;
  const parsed = Number(body[key]);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : Number.NaN;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'pod_capture'))) return respond(503, { error: 'POD capture is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;
  if (!driver.companyId) return respond(403, { error: 'Driver company is required for POD confirmation.' });

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const recipientName = stringField(body, 'recipientName', 200);
  if (!recipientName) return respond(400, { error: 'Recipient name is required.' });

  const leftAt = stringField(body, 'leftAt', 200);
  const packaging = stringField(body, 'packaging', 200);
  const driverNotes = stringField(body, 'driverNotes', 1_000);
  const requestedStatus = stringField(body, 'deliveryStatus', 40).toLowerCase() || 'completed';
  if (!DELIVERY_STATUSES.has(requestedStatus)) return respond(400, { error: 'Unsupported delivery status.' });

  const numberOfItems = optionalNumber(body, 'numberOfItems', 0, 100_000);
  if (Number.isNaN(numberOfItems)) return respond(400, { error: 'Number of items is invalid.' });
  const weightKg = optionalNumber(body, 'weightKg', 0, 100_000);
  if (Number.isNaN(weightKg)) return respond(400, { error: 'Delivery weight is invalid.' });

  const deliveredAtRaw = stringField(body, 'deliveredAt', 80);
  const deliveredAtParsed = deliveredAtRaw ? new Date(deliveredAtRaw) : new Date();
  if (Number.isNaN(deliveredAtParsed.getTime())) return respond(400, { error: 'Delivered time is invalid.' });
  const nowMs = Date.now();
  if (Math.abs(deliveredAtParsed.getTime() - nowMs) > 7 * 24 * 60 * 60 * 1000) {
    return respond(400, { error: 'Delivered time must be within seven days of this confirmation.' });
  }

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
  if (!evidencePath) return respond(409, { error: 'Upload POD evidence first.' });

  const expectedPrefix = `${driver.companyId}/${id}/`;
  if (!evidencePath.startsWith(expectedPrefix)) {
    return respond(409, { error: 'POD evidence does not belong to this driver assignment.' });
  }

  const requestedSignaturePath = stringField(body, 'signatureEvidencePath', 600);
  const signatureEvidencePath = requestedSignaturePath || null;
  if (signatureEvidencePath && (!signatureEvidencePath.startsWith(expectedPrefix) || !evidence.includes(signatureEvidencePath))) {
    return respond(409, { error: 'Signature evidence does not belong to this driver assignment.' });
  }

  const now = new Date().toISOString();
  const confirmation = {
    type: signatureEvidencePath ? 'recipient_signature_evidence' : 'recipient_typed_name_attestation',
    signature_method: signatureEvidencePath ? 'drawn_or_image_evidence' : 'typed_name_attestation',
    evidence_path: evidencePath,
    signature_evidence_path: signatureEvidencePath,
    recipient_name: recipientName,
    left_at: leftAt || null,
    delivered_at: deliveredAtParsed.toISOString(),
    delivery_status: requestedStatus,
    number_of_items: numberOfItems,
    packaging: packaging || null,
    weight_kg: weightKg,
    driver_notes: driverNotes || null,
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
      pod_generated: true,
      pod_generated_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('assigned_driver_id', driver.driverId)
    .select('id')
    .maybeSingle();

  if (error) return respond(500, { error: error.message });
  if (!updated) return respond(409, { error: 'Delivery evidence could not be linked to this assignment.' });
  return respond(200, {
    ok: true,
    signatureMethod: confirmation.signature_method,
    deliveryStatus: requestedStatus,
    deliveredAt: deliveredAtParsed.toISOString(),
  });
}
