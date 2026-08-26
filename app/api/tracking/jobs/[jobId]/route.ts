import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { isTrafficEtaConfigured, readTrafficEtaSnapshot } from '../../../../../lib/tracking/trafficEta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACTIVE = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);
const DELIVERY_ETA_PHASES = new Set([
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
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

function etaRisk(lateByMinutes: number | null | undefined) {
  if (lateByMinutes == null || !Number.isFinite(lateByMinutes)) return null;
  if (lateByMinutes <= 5) return { level: 'on_time', late_by_minutes: Math.max(0, lateByMinutes) };
  if (lateByMinutes <= 20) return { level: 'at_risk', late_by_minutes: lateByMinutes };
  return { level: 'late', late_by_minutes: lateByMinutes };
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

  // Viewers never call the traffic provider. They all read one server-side snapshot
  // generated by the driver's GPS publisher at most once every 15 minutes per job.
  const eta = DELIVERY_ETA_PHASES.has(phase)
    ? await readTrafficEtaSnapshot(supabaseAdmin, job.id)
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
    eta_risk: etaRisk(eta?.late_by_minutes),
    planned_delivery_at: job.delivery_datetime ?? null,
    eta_provider_configured: isTrafficEtaConfigured(),
  });
}
