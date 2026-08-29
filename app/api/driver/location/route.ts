import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { requireActiveNativeAuthSession } from '../mobile/_deviceSessionGate';
import { getOrRefreshTrafficEta } from '../../../../lib/tracking/trafficEta';

type LocationPayload = { job_id?: string; lat?: number; lng?: number; heading?: number | null; speed_mph?: number | null };
type JobCandidate = {
  id: string; company_id: string | null; assigned_driver_id: string | null; assigned_company_id: string | null; awarded_carrier_company_id: string | null;
  current_status: string | null; status: string | null; delivery_postcode: string | null; delivery_datetime: string | null;
};

const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);
const DELIVERY_ETA_STATUSES = new Set([
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);
const ETA_ALERT_MIN_LATE_MINUTES = 5;
const ETA_ALERT_COOLDOWN_MS = 15 * 60_000;
const ETA_ALERT_CHANGE_MINUTES = 10;
const statusOf = (job: Pick<JobCandidate, 'current_status' | 'status'>) => String(job.current_status ?? job.status ?? '').trim().toLowerCase();
const assignedCarrierCompanyId = (job: Pick<JobCandidate, 'awarded_carrier_company_id' | 'assigned_company_id'>) =>
  job.awarded_carrier_company_id ?? job.assigned_company_id;

async function maybeCreateEtaAlerts(job: JobCandidate, lat: number, lng: number) {
  if (!supabaseAdmin || !job.company_id || !DELIVERY_ETA_STATUSES.has(statusOf(job))) return;
  const eta = await getOrRefreshTrafficEta({
    admin: supabaseAdmin,
    jobId: job.id,
    originLat: lat,
    originLng: lng,
    deliveryPostcode: job.delivery_postcode,
    plannedDeliveryAt: job.delivery_datetime,
  });
  if (!eta || eta.late_by_minutes == null || eta.late_by_minutes <= ETA_ALERT_MIN_LATE_MINUTES) return;
  const lateByMinutes = eta.late_by_minutes;

  const { data: latestAlert } = await supabaseAdmin
    .from('notification_events')
    .select('created_at, payload')
    .eq('event_type', 'tracking_eta_alert')
    .eq('entity_type', 'job')
    .eq('entity_id', job.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestAlert?.created_at) {
    const lastCreatedMs = new Date(latestAlert.created_at).getTime();
    const previousLateBy = Number((latestAlert.payload as Record<string, unknown> | null)?.late_by_minutes);
    const withinCooldown = Number.isFinite(lastCreatedMs) && Date.now() - lastCreatedMs < ETA_ALERT_COOLDOWN_MS;
    const materialChange = !Number.isFinite(previousLateBy) || Math.abs(lateByMinutes - previousLateBy) >= ETA_ALERT_CHANGE_MINUTES;
    if (withinCooldown && !materialChange) return;
  }

  const { data: recipients } = await supabaseAdmin
    .from('company_memberships')
    .select('user_id')
    .eq('company_id', job.company_id)
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .limit(100);
  const recipientIds = [...new Set((recipients ?? []).map((row) => String(row.user_id ?? '')).filter(Boolean))];
  if (recipientIds.length === 0) return;
  const now = new Date().toISOString();
  const payload = {
    job_id: job.id,
    eta_at: eta.eta_at,
    planned_delivery_at: job.delivery_datetime,
    late_by_minutes: lateByMinutes,
    message: `Traffic ETA alert: delivery is currently predicted about ${lateByMinutes} minutes after the planned delivery time.`,
  };
  await supabaseAdmin.from('notification_events').insert(recipientIds.map((recipientUserId) => ({
    event_type: 'tracking_eta_alert', entity_type: 'job', entity_id: job.id, company_id: job.company_id,
    recipient_user_id: recipientUserId, payload, status: 'sent', processed_at: now,
  })));
}

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

  const deviceGate = await requireActiveNativeAuthSession(request, authData.user.id, String(driverRow.id));
  if (deviceGate) return deviceGate;

  let body: LocationPayload;
  try { body = (await request.json()) as LocationPayload; } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const requestedJobId = typeof body.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : null;
  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;
  if (lat === null || lng === null) return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return NextResponse.json({ error: 'Invalid lat/lng values.' }, { status: 400 });

  const jobSelect = 'id, company_id, assigned_driver_id, assigned_company_id, awarded_carrier_company_id, current_status, status, delivery_postcode, delivery_datetime';
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
    recorded_at: new Date().toISOString(),
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  await maybeCreateEtaAlerts(jobRow, lat, lng).catch(() => undefined);
  return NextResponse.json({ ok: true, job_id: jobRow.id });
}
