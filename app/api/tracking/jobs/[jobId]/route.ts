import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACTIVE = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
});

const statusOf = (job: { current_status?: string | null; status?: string | null }) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

async function isCompanyMember(userId: string, companyId: string | null) {
  if (!companyId) return false;
  const { data, error } = await supabaseAdmin!
    .from('company_memberships')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return !error && Boolean(data);
}

async function trafficEta(lat: number, lng: number, deliveryPostcode: string | null) {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token || !deliveryPostcode) return null;
  try {
    const postcodeResponse = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(deliveryPostcode)}`, {
      signal: AbortSignal.timeout(4_000),
      cache: 'no-store',
    });
    if (!postcodeResponse.ok) return null;
    const postcodePayload = await postcodeResponse.json() as { result?: { latitude?: number; longitude?: number } | null };
    const destinationLat = Number(postcodePayload.result?.latitude);
    const destinationLng = Number(postcodePayload.result?.longitude);
    if (!Number.isFinite(destinationLat) || !Number.isFinite(destinationLng)) return null;

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${lng},${lat};${destinationLng},${destinationLat}?overview=false&steps=false&access_token=${encodeURIComponent(token)}`;
    const routeResponse = await fetch(url, { signal: AbortSignal.timeout(5_000), cache: 'no-store' });
    if (!routeResponse.ok) return null;
    const routePayload = await routeResponse.json() as { routes?: Array<{ duration?: number; distance?: number }> };
    const route = routePayload.routes?.[0];
    const durationSeconds = Number(route?.duration);
    const distanceMetres = Number(route?.distance);
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return null;
    return {
      eta_at: new Date(Date.now() + durationSeconds * 1000).toISOString(),
      remaining_minutes: Math.max(0, Math.round(durationSeconds / 60)),
      remaining_miles: Number.isFinite(distanceMetres) ? Math.round((distanceMetres / 1609.344) * 10) / 10 : null,
      source: 'mapbox-driving-traffic',
    };
  } catch {
    return null;
  }
}

function etaRisk(etaAt: string | null | undefined, plannedDelivery: string | null | undefined) {
  if (!etaAt || !plannedDelivery) return null;
  const etaMs = new Date(etaAt).getTime();
  const plannedMs = new Date(plannedDelivery).getTime();
  if (!Number.isFinite(etaMs) || !Number.isFinite(plannedMs)) return null;
  const deltaMinutes = Math.round((etaMs - plannedMs) / 60_000);
  if (deltaMinutes <= 5) return { level: 'on_time', late_by_minutes: Math.max(0, deltaMinutes) };
  if (deltaMinutes <= 20) return { level: 'at_risk', late_by_minutes: deltaMinutes };
  return { level: 'late', late_by_minutes: deltaMinutes };
}

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Live tracking is temporarily unavailable.' });

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Your session has expired. Sign in again.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Your session has expired. Sign in again.' });

  const { jobId } = await context.params;
  if (!UUID.test(jobId)) return json(400, { error: 'Invalid job id.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, assigned_driver_id, current_status, status, delivery_postcode, delivery_location, delivery_datetime')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return json(500, { error: 'Tracking job could not be loaded.' });
  if (!job) return json(404, { error: 'Job not found.' });

  const [posterAccess, carrierAccess, driverSelf] = await Promise.all([
    isCompanyMember(authData.user.id, job.company_id ?? null),
    isCompanyMember(authData.user.id, job.awarded_carrier_company_id ?? null),
    job.assigned_driver_id
      ? supabaseAdmin.from('drivers').select('id').eq('id', job.assigned_driver_id).eq('user_id', authData.user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (!posterAccess && !carrierAccess && !driverSelf.data) return json(403, { error: 'You do not have access to tracking for this job.' });

  const phase = statusOf(job);
  if (!ACTIVE.has(phase)) {
    return json(200, {
      job_id: job.id,
      phase,
      tracking_active: false,
      location: null,
      eta: null,
      eta_risk: null,
      planned_delivery_at: job.delivery_datetime ?? null,
      reason: ['delivered', 'completed', 'invoiced', 'paid'].includes(phase) ? 'completed' : 'not-in-execution',
    });
  }

  if (!job.assigned_driver_id) return json(200, {
    job_id: job.id,
    phase,
    tracking_active: false,
    location: null,
    eta: null,
    eta_risk: null,
    planned_delivery_at: job.delivery_datetime ?? null,
    reason: 'driver-not-assigned',
  });

  const [{ data: location, error: locationError }, { data: driver }] = await Promise.all([
    supabaseAdmin
      .from('driver_locations')
      .select('id, driver_id, job_id, lat, lng, heading, speed_mph, recorded_at, updated_at')
      .eq('job_id', job.id)
      .eq('driver_id', job.assigned_driver_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin.from('drivers').select('id, display_name').eq('id', job.assigned_driver_id).maybeSingle(),
  ]);
  if (locationError) return json(500, { error: 'Live position could not be loaded.' });

  if (!location) return json(200, {
    job_id: job.id,
    phase,
    tracking_active: true,
    location: null,
    eta: null,
    eta_risk: null,
    planned_delivery_at: job.delivery_datetime ?? null,
    reason: 'awaiting-first-position',
  });

  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const recordedAt = location.recorded_at ?? location.updated_at ?? null;
  const ageMs = recordedAt ? Date.now() - new Date(recordedAt).getTime() : Number.POSITIVE_INFINITY;
  const fresh = Number.isFinite(ageMs) && ageMs <= 3 * 60_000;
  const eta = Number.isFinite(lat) && Number.isFinite(lng)
    ? await trafficEta(lat, lng, job.delivery_postcode ?? null)
    : null;

  return json(200, {
    job_id: job.id,
    phase,
    tracking_active: true,
    fresh,
    driver: { id: job.assigned_driver_id, display_name: driver?.display_name ?? 'Assigned driver' },
    location: {
      lat,
      lng,
      heading: location.heading ?? null,
      speed_mph: location.speed_mph ?? null,
      recorded_at: recordedAt,
    },
    eta,
    eta_risk: etaRisk(eta?.eta_at, job.delivery_datetime),
    planned_delivery_at: job.delivery_datetime ?? null,
    eta_provider_configured: Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim()),
  });
}
