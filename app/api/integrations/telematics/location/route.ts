import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;
const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

type TelematicsLocationPayload = {
  provider?: string;
  event_id?: string;
  driver_id?: string;
  job_id?: string;
  lat?: number;
  lng?: number;
  heading?: number | null;
  speed_mph?: number | null;
  recorded_at?: string;
};

type DriverRow = {
  id: string;
  company_id: string | null;
  status: string | null;
};

type JobRow = {
  id: string;
  assigned_driver_id: string | null;
  awarded_carrier_company_id: string | null;
  current_status: string | null;
  status: string | null;
};

function statusOf(job: Pick<JobRow, 'current_status' | 'status'>) {
  return String(job.current_status ?? job.status ?? '').trim().toLowerCase();
}

function safeEqualHex(expectedHex: string, suppliedHex: string) {
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const supplied = Buffer.from(suppliedHex, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function verifySignature(rawBody: string, request: NextRequest) {
  const secret = process.env.TELEMATICS_INGEST_SECRET?.trim();
  if (!secret) return { ok: false as const, status: 503, error: 'Telematics ingestion is not configured.' };

  const timestampHeader = request.headers.get('x-xdrive-timestamp')?.trim() ?? '';
  const signatureHeader = request.headers.get('x-xdrive-signature')?.trim().replace(/^sha256=/i, '') ?? '';
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return { ok: false as const, status: 401, error: 'Invalid telematics signature.' };

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > MAX_SIGNATURE_AGE_SECONDS) {
    return { ok: false as const, status: 401, error: 'Expired telematics signature.' };
  }

  const expected = createHmac('sha256', secret).update(`${timestampHeader}.${rawBody}`).digest('hex');
  if (!safeEqualHex(expected, signatureHeader)) {
    return { ok: false as const, status: 401, error: 'Invalid telematics signature.' };
  }
  return { ok: true as const };
}

function validRecordedAt(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = Date.now();
  if (parsed.getTime() > now + 5 * 60_000 || parsed.getTime() < now - 24 * 60 * 60_000) return null;
  return parsed.toISOString();
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Telematics ingestion is temporarily unavailable.' });
  }

  const rawBody = await request.text();
  const signature = verifySignature(rawBody, request);
  if (!signature.ok) return json(signature.status, { error: signature.error });

  let body: TelematicsLocationPayload;
  try {
    body = JSON.parse(rawBody) as TelematicsLocationPayload;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const provider = typeof body.provider === 'string' ? body.provider.trim().toLowerCase() : '';
  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : '';
  const driverId = typeof body.driver_id === 'string' ? body.driver_id.trim() : '';
  const requestedJobId = typeof body.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : null;
  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : null;
  const recordedAt = validRecordedAt(body.recorded_at);

  if (!PROVIDER_PATTERN.test(provider)) return json(400, { error: 'A valid provider slug is required.' });
  if (!eventId || eventId.length > 160) return json(400, { error: 'A valid event_id is required.' });
  if (!driverId) return json(400, { error: 'driver_id is required.' });
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json(400, { error: 'Valid lat and lng values are required.' });
  }
  if (!recordedAt) return json(400, { error: 'recorded_at must be within the accepted ingestion window.' });

  const { data: duplicate } = await supabaseAdmin
    .from('driver_locations')
    .select('id, job_id')
    .eq('source', 'telematics')
    .eq('source_provider', provider)
    .eq('source_event_id', eventId)
    .maybeSingle();
  if (duplicate) return json(200, { ok: true, duplicate: true, job_id: duplicate.job_id ?? null });

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('id', driverId)
    .eq('status', 'active')
    .maybeSingle();
  if (driverError || !driver) return json(403, { error: 'Active driver could not be resolved.' });
  const driverRow = driver as DriverRow;

  const jobSelect = 'id, assigned_driver_id, awarded_carrier_company_id, current_status, status';
  let jobRow: JobRow | null = null;
  if (requestedJobId) {
    const { data, error } = await supabaseAdmin.from('jobs').select(jobSelect).eq('id', requestedJobId).maybeSingle();
    if (error) return json(500, { error: 'Assigned job could not be resolved.' });
    jobRow = data as unknown as JobRow | null;
  } else {
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .select(jobSelect)
      .eq('assigned_driver_id', driverRow.id)
      .order('updated_at', { ascending: false })
      .limit(10);
    if (error) return json(500, { error: 'Assigned jobs could not be resolved.' });
    const active = ((data ?? []) as unknown as JobRow[]).filter((job) => ACTIVE_JOB_STATUSES.has(statusOf(job)));
    if (active.length !== 1) return json(409, { error: 'A single active job could not be identified for tracking.' });
    jobRow = active[0];
  }

  if (!jobRow || jobRow.assigned_driver_id !== driverRow.id || !ACTIVE_JOB_STATUSES.has(statusOf(jobRow))) {
    return json(403, { error: 'Telematics publishing is not authorised for this job state.' });
  }
  if (jobRow.awarded_carrier_company_id && driverRow.company_id && jobRow.awarded_carrier_company_id !== driverRow.company_id) {
    return json(403, { error: 'Driver company does not match the awarded carrier.' });
  }

  const heading = typeof body.heading === 'number' && Number.isFinite(body.heading) ? body.heading : null;
  const speedMph = typeof body.speed_mph === 'number' && Number.isFinite(body.speed_mph) && body.speed_mph >= 0 ? body.speed_mph : null;
  const { error: insertError } = await supabaseAdmin.from('driver_locations').insert({
    driver_id: driverRow.id,
    company_id: driverRow.company_id ?? null,
    job_id: jobRow.id,
    lat,
    lng,
    heading,
    speed_mph: speedMph,
    recorded_at: recordedAt,
    source: 'telematics',
    source_provider: provider,
    source_event_id: eventId,
  });
  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') return json(200, { ok: true, duplicate: true, job_id: jobRow.id });
    return json(500, { error: 'Telematics location could not be stored.' });
  }

  return json(200, { ok: true, duplicate: false, job_id: jobRow.id });
}
