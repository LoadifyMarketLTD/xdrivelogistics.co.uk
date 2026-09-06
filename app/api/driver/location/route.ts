import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import { requireActiveNativeAuthSession } from '../mobile/_deviceSessionGate';
import { toPostgisPoint } from '../../../../lib/geoLocation';

type LocationPayload = {
  job_id?: string;
  lat?: number;
  lng?: number;
  heading?: number | null;
  speed_mph?: number | null;
};

const TRACKABLE_CURRENT_STATES = new Set([
  'on_my_way',
  'on_my_way_pickup',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'arrived_pickup',
  'loaded',
  'in_transit',
  'on_my_way_delivery',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'arrived_delivery',
]);

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: driverRow, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, status, app_access')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (driverError || !driverRow) return NextResponse.json({ error: 'Driver record not found.' }, { status: 403 });
  if (driverRow.app_access !== true || String(driverRow.status ?? '').toLowerCase() !== 'active') {
    return NextResponse.json({ error: 'Active driver access is required.' }, { status: 403 });
  }

  const deviceGate = await requireActiveNativeAuthSession(request, authData.user.id, String(driverRow.id));
  if (deviceGate) return deviceGate;

  let body: LocationPayload;
  try {
    body = (await request.json()) as LocationPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  if (!jobId) return NextResponse.json({ error: 'An active job id is required for tracking.' }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,status,current_status,assigned_driver_id')
    .eq('id', jobId)
    .eq('assigned_driver_id', driverRow.id)
    .maybeSingle();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Tracking is not authorised for this job.' }, { status: 403 });

  const lifecycle = String(job.status ?? '').trim().toLowerCase();
  const currentStatus = String(job.current_status ?? '').trim().toLowerCase();
  if (!['allocated', 'collected', 'in_transit'].includes(lifecycle) || !TRACKABLE_CURRENT_STATES.has(currentStatus)) {
    return NextResponse.json({ error: 'Tracking is allowed only during active job execution.' }, { status: 409 });
  }

  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;
  if (lat === null || lng === null) return NextResponse.json({ error: 'lat and lng are required.' }, { status: 400 });
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return NextResponse.json({ error: 'Invalid lat/lng values.' }, { status: 400 });

  const now = new Date().toISOString();
  const { error: insertError } = await supabaseAdmin
    .from('driver_locations')
    .insert({
      driver_id: driverRow.id,
      location: toPostgisPoint(lng, lat),
      recorded_at: now,
    });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true, jobId });
}
