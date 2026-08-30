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
  provider_driver_id?: string;
  provider_vehicle_id?: string;
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

type BindingRow = {
  driver_id: string;
  vehicle_id: string;
  company_id: string;
  external_vehicle_id: string;
};

type VehicleRow = {
  id: string;
  company_id: string | null;
  assigned_driver_id: string | null;
  status: string | null;
};

type JobRow = {
  id: string;
  assigned_driver_id: string | null;
  vehicle_id: string | null;
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

function providerSecret(provider: string) {
  const configured = process.env.TELEMATICS_INGEST_SECRETS_JSON?.trim();
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as Record<string, unknown>;
      const candidate = parsed[provider];
      if (typeof candidate === 'string' && candidate.trim().length >= 32) return candidate.trim();
    } catch {
      return null;
    }
  }

  // Single-provider compatibility remains provider-bound rather than allowing
  // one global secret to authenticate arbitrary provider namespaces.
  const legacyProvider = process.env.TELEMATICS_INGEST_PROVIDER?.trim().toLowerCase();
  const legacySecret = process.env.TELEMATICS_INGEST_SECRET?.trim();
  if (legacyProvider === provider && legacySecret && legacySecret.length >= 32) return legacySecret;
  return null;
}

function verifySignature(rawBody: string, request: NextRequest, provider: string) {
  const secret = providerSecret(provider);
  if (!secret) return { ok: false as const, status: 503, error: 'Telematics provider ingestion is not configured.' };

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
  let body: TelematicsLocationPayload;
  try {
    body = JSON.parse(rawBody) as TelematicsLocationPayload;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const provider = typeof body.provider === 'string' ? body.provider.trim().toLowerCase() : '';
  if (!PROVIDER_PATTERN.test(provider)) return json(400, { error: 'A valid provider slug is required.' });

  const signature = verifySignature(rawBody, request, provider);
  if (!signature.ok) return json(signature.status, { error: signature.error });

  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : '';
  const directDriverId = typeof body.driver_id === 'string' ? body.driver_id.trim() : '';
  const providerDriverId = typeof body.provider_driver_id === 'string' ? body.provider_driver_id.trim() : '';
  const providerVehicleId = typeof body.provider_vehicle_id === 'string' ? body.provider_vehicle_id.trim() : '';
  const requestedJobId = typeof body.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : null;
  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : null;
  const recordedAt = validRecordedAt(body.recorded_at);

  if (!eventId || eventId.length > 160) return json(400, { error: 'A valid event_id is required.' });
  if (!providerDriverId) return json(400, { error: 'provider_driver_id is required.' });
  if (!providerVehicleId) return json(400, { error: 'provider_vehicle_id is required.' });
  if (providerDriverId.length > 200 || providerVehicleId.length > 200) return json(400, { error: 'Provider identity is too long.' });
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

  const { data: bindingData, error: bindingError } = await supabaseAdmin
    .from('telematics_driver_bindings')
    .select('driver_id, vehicle_id, company_id, external_vehicle_id')
    .eq('provider', provider)
    .eq('external_driver_id', providerDriverId)
    .eq('external_vehicle_id', providerVehicleId)
    .eq('enabled', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (bindingError) {
    return json(503, { error: 'Telematics provider identity mapping is not available yet.' });
  }
  if (!bindingData) {
    return json(403, { error: 'Telematics driver and vehicle identities are not bound to XDrive.' });
  }

  const binding = bindingData as unknown as BindingRow;
  if (directDriverId && directDriverId !== binding.driver_id) {
    return json(409, { error: 'Telematics driver identifiers do not resolve to the same XDrive driver.' });
  }

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status')
    .eq('id', binding.driver_id)
    .eq('status', 'active')
    .maybeSingle();
  if (driverError || !driver) return json(403, { error: 'Active driver could not be resolved.' });
  const driverRow = driver as DriverRow;
  if (!driverRow.company_id || driverRow.company_id !== binding.company_id) {
    return json(403, { error: 'Telematics binding company does not match the active driver company.' });
  }

  const { data: vehicle, error: vehicleError } = await supabaseAdmin
    .from('vehicles')
    .select('id, company_id, assigned_driver_id, status')
    .eq('id', binding.vehicle_id)
    .eq('company_id', binding.company_id)
    .eq('assigned_driver_id', driverRow.id)
    .eq('status', 'active')
    .maybeSingle();
  if (vehicleError || !vehicle) {
    return json(403, { error: 'Telematics vehicle is not the active canonical vehicle for this driver.' });
  }
  const vehicleRow = vehicle as VehicleRow;

  const jobSelect = 'id, assigned_driver_id, vehicle_id, awarded_carrier_company_id, current_status, status';
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
  if (jobRow.awarded_carrier_company_id && jobRow.awarded_carrier_company_id !== binding.company_id) {
    return json(403, { error: 'Driver company does not match the awarded carrier.' });
  }
  if (jobRow.vehicle_id && jobRow.vehicle_id !== vehicleRow.id) {
    return json(403, { error: 'Telematics vehicle does not match the vehicle assigned to this job.' });
  }

  const heading = typeof body.heading === 'number' && Number.isFinite(body.heading) ? body.heading : null;
  const speedMph = typeof body.speed_mph === 'number' && Number.isFinite(body.speed_mph) && body.speed_mph >= 0 ? body.speed_mph : null;
  const { error: insertError } = await supabaseAdmin.from('driver_locations').insert({
    driver_id: driverRow.id,
    vehicle_id: vehicleRow.id,
    company_id: binding.company_id,
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