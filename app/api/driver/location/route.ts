import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { maybeCreateOperationalLocationAlerts, type OperationalAlertJob } from '../../../../lib/tracking/operationalAlerts';

type LocationPayload = { job_id?: string; lat?: number; lng?: number; heading?: number | null; speed_mph?: number | null };
type JobCandidate = OperationalAlertJob & {
  assigned_driver_id: string | null;
  assigned_company_id: string | null;
  awarded_carrier_company_id: string | null;
};

const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);
const statusOf = (job: Pick<JobCandidate, 'current_status' | 'status'>) => String(job.current_status ?? job.status ?? '').trim().toLowerCase();
const assignedCarrierCompanyId = (job: Pick<JobCandidate, 'awarded_carrier_company_id' | 'assigned_company_id'>) =>
  job.awarded_carrier_company_id ?? job.assigned_company_id;

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: driverRow, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status, app_access')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (driverError || !driverRow || driverRow.app_access !== true) {
    return NextResponse.json({ error: 'Active Driver location access is not available.' }, { status: 403 });
  }

  let body: LocationPayload;
  try { body = (await request.json()) as LocationPayload; } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const requestedJobId = typeof body.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : null;
  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;
  if (lat === null || lng === null) return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return NextResponse.json({ error: 'Invalid lat/lng values.' }, { status: 400 });

  const jobSelect = 'id, company_id, assigned_driver_id, assigned_company_id, awarded_carrier_company_id, current_status, status, pickup_lat, pickup_lng, delivery_lat, delivery_lng, pickup_postcode, delivery_postcode, delivery_datetime, proximity_alerts_enabled, pickup_proximity_alert_enabled, delivery_proximity_alert_enabled, pickup_alert_radius_miles, delivery_alert_radius_miles, smart_alert_in_app_enabled, smart_alert_email_enabled, smart_alert_push_enabled';
  let jobRow: JobCandidate | null = null;
  if (requestedJobId) {
    const { data, error } = await supabaseAdmin.from('jobs').select(jobSelect).eq('id', requestedJobId).maybeSingle();
    if (error) return NextResponse.json({ error: 'Assigned job could not be resolved.' }, { status: 500 });
    jobRow = data as unknown as JobCandidate | null;
  } else {
    const { data, error } = await supabaseAdmin.from('jobs').select(jobSelect).eq('assigned_driver_id', driverRow.id).order('updated_at', { ascending: false }).limit(10);
    if (error) return NextResponse.json({ error: 'Assigned jobs could not be resolved.' }, { status: 500 });
    const active = ((data ?? []) as unknown as JobCandidate[]).filter((job) => ACTIVE_JOB_STATUSES.has(statusOf(job)));
    if (active.length !== 1) return NextResponse.json({ error: 'A single active job could not be identified for tracking.' }, { status: 409 });
    jobRow = active[0];
  }

  if (!jobRow || jobRow.assigned_driver_id !== driverRow.id || !ACTIVE_JOB_STATUSES.has(statusOf(jobRow))) {
    return NextResponse.json({ error: 'Location publishing is not authorised for this job state.' }, { status: 403 });
  }
  // Match the authoritative lifecycle RPC tenant boundary. The awarded carrier
  // is canonical when present; assigned_company_id remains the fleet/legacy
  // fallback. Individual-driver jobs with no carrier company remain valid.
  const carrierCompanyId = assignedCarrierCompanyId(jobRow);
  if (carrierCompanyId && carrierCompanyId !== driverRow.company_id) {
    return NextResponse.json({ error: 'Driver company does not match the assigned carrier.' }, { status: 403 });
  }

  const heading = typeof body.heading === 'number' && Number.isFinite(body.heading) ? body.heading : null;
  const speedMph = typeof body.speed_mph === 'number' && Number.isFinite(body.speed_mph) && body.speed_mph >= 0 ? body.speed_mph : null;
  const { error: insertError } = await supabaseAdmin.from('driver_locations').insert({
    driver_id: driverRow.id, company_id: driverRow.company_id ?? null, job_id: jobRow.id, lat, lng, heading, speed_mph: speedMph,
    source: 'driver_web', source_provider: 'browser_geolocation', recorded_at: new Date().toISOString(),
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await maybeCreateOperationalLocationAlerts(supabaseAdmin, jobRow, lat, lng, 'driver_web').catch(() => undefined);
  return NextResponse.json({ ok: true, job_id: jobRow.id });
}
