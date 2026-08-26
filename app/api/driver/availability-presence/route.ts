import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const VISIBILITIES = new Set(['private', 'fleet', 'exchange']);
const MAX_HOURS = 8;
const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);

// Native Android consumes these GET/POST/DELETE response envelopes through the
// same authenticated server boundary; keep availability separate from job GPS.
const roundedForExchange = (value: number) => Math.round(value * 100) / 100;
const statusOf = (job: { current_status?: string | null; status?: string | null }) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

async function hasActiveAssignedJob(driverId: string) {
  const { data, error } = await supabaseAdmin!
    .from('jobs')
    .select('current_status, status')
    .eq('assigned_driver_id', driverId)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Assigned jobs could not be verified.');
  return (data ?? []).some((job) => ACTIVE_JOB_STATUSES.has(statusOf(job)));
}

async function authenticatedDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 }) };
  const token = getBearerToken(request);
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status, app_access, availability_status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (driverError || !driver || driver.app_access !== true) return { error: NextResponse.json({ error: 'Active driver access is required.' }, { status: 403 }) };
  return { driver };
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;

  if (String(auth.driver.availability_status ?? '').toLowerCase() !== 'available') {
    return NextResponse.json({ active: false, presence: null });
  }
  try {
    if (await hasActiveAssignedJob(auth.driver.id)) {
      return NextResponse.json({ active: false, presence: null });
    }
  } catch {
    return NextResponse.json({ error: 'Availability eligibility could not be verified.' }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin!
    .from('driver_availability_presence')
    .select('visibility, available_until, recorded_at, updated_at')
    .eq('driver_id', auth.driver.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Availability presence could not be loaded.' }, { status: 500 });
  const active = Boolean(data?.available_until && new Date(data.available_until).getTime() > Date.now());
  return NextResponse.json({ active, presence: active ? data : null });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;
  if (String(auth.driver.availability_status ?? '').toLowerCase() !== 'available') {
    return NextResponse.json({ error: 'Set your driver status to Available before sharing availability location.' }, { status: 409 });
  }
  try {
    if (await hasActiveAssignedJob(auth.driver.id)) {
      return NextResponse.json({ error: 'Availability sharing is disabled while you have an active assigned job.' }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: 'Availability eligibility could not be verified.' }, { status: 500 });
  }

  let body: { lat?: number; lng?: number; visibility?: string; hours?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const lat = typeof body.lat === 'number' ? body.lat : Number.NaN;
  const lng = typeof body.lng === 'number' ? body.lng : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Valid lat/lng are required.' }, { status: 400 });
  }
  const visibility = typeof body.visibility === 'string' && VISIBILITIES.has(body.visibility) ? body.visibility : 'private';
  const requestedHours = typeof body.hours === 'number' && Number.isFinite(body.hours) ? body.hours : 4;
  const hours = Math.min(MAX_HOURS, Math.max(1, Math.round(requestedHours)));
  const now = new Date();
  const availableUntil = new Date(now.getTime() + hours * 60 * 60_000).toISOString();

  const { error } = await supabaseAdmin!.from('driver_availability_presence').upsert({
    driver_id: auth.driver.id,
    company_id: auth.driver.company_id ?? null,
    visibility,
    exact_lat: lat,
    exact_lng: lng,
    exchange_lat: roundedForExchange(lat),
    exchange_lng: roundedForExchange(lng),
    available_until: availableUntil,
    recorded_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'driver_id' });
  if (error) return NextResponse.json({ error: 'Availability presence could not be updated.' }, { status: 500 });
  return NextResponse.json({ ok: true, visibility, available_until: availableUntil });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;
  const { error } = await supabaseAdmin!.from('driver_availability_presence').delete().eq('driver_id', auth.driver.id);
  if (error) return NextResponse.json({ error: 'Availability presence could not be stopped.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
