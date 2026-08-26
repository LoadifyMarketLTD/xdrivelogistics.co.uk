import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

type LocationPayload = {
  job_id?: string;
  lat?: number;
  lng?: number;
  heading?: number | null;
  speed_mph?: number | null;
};

const ACTIVE_JOB_STATUSES = new Set([
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
]);

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

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
  try {
    body = (await request.json()) as LocationPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const jobId = typeof body.job_id === 'string' && body.job_id.trim() ? body.job_id.trim() : null;
  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;

  if (!jobId) return NextResponse.json({ error: 'job_id is required.' }, { status: 400 });
  if (lat === null || lng === null) return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Invalid lat/lng values.' }, { status: 400 });
  }

  const { data: jobRow, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, awarded_carrier_company_id, current_status, status')
    .eq('id', jobId)
    .maybeSingle();

  const jobStatus = String(jobRow?.current_status ?? jobRow?.status ?? '').trim().toLowerCase();
  if (
    jobError
    || !jobRow
    || jobRow.assigned_driver_id !== driverRow.id
    || !ACTIVE_JOB_STATUSES.has(jobStatus)
  ) {
    return NextResponse.json({ error: 'Location publishing is not authorised for this job state.' }, { status: 403 });
  }

  if (jobRow.awarded_carrier_company_id && driverRow.company_id && jobRow.awarded_carrier_company_id !== driverRow.company_id) {
    return NextResponse.json({ error: 'Driver company does not match the awarded carrier.' }, { status: 403 });
  }

  const heading = typeof body.heading === 'number' && Number.isFinite(body.heading) ? body.heading : null;
  const speedMph = typeof body.speed_mph === 'number' && Number.isFinite(body.speed_mph) && body.speed_mph >= 0
    ? body.speed_mph
    : null;

  const { error: insertError } = await supabaseAdmin
    .from('driver_locations')
    .insert({
      driver_id: driverRow.id,
      company_id: driverRow.company_id ?? null,
      job_id: jobId,
      lat,
      lng,
      heading,
      speed_mph: speedMph,
      recorded_at: new Date().toISOString(),
    });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
