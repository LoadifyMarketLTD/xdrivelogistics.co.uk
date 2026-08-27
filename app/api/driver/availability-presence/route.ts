import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../mobile/_lib';

const VISIBILITIES = new Set(['private', 'fleet', 'exchange']);
const MAX_HOURS = 8;
const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);

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
  const context = await requireDriver(request);
  if (!isDriverContext(context)) return { error: context };

  const { data: driver, error } = await supabaseAdmin!
    .from('drivers')
    .select('id, company_id, availability_status')
    .eq('id', context.driverId)
    .maybeSingle();
  if (error || !driver) return { error: NextResponse.json({ error: 'Active driver access is required.' }, { status: 403 }) };
  return { driver };
}

async function ensureAvailabilityEligible(driver: { id: string; availability_status?: string | null }) {
  if (String(driver.availability_status ?? '').toLowerCase() !== 'available') {
    return NextResponse.json({ error: 'Set your driver status to Available before sharing availability location.' }, { status: 409 });
  }
  try {
    if (await hasActiveAssignedJob(driver.id)) {
      return NextResponse.json({ error: 'Availability sharing is disabled while you have an active assigned job.' }, { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: 'Availability eligibility could not be verified.' }, { status: 500 });
  }
  return null;
}

function parseCoordinates(body: { lat?: number; lng?: number }) {
  const lat = typeof body.lat === 'number' ? body.lat : Number.NaN;
  const lng = typeof body.lng === 'number' ? body.lng : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;
  const eligibilityError = await ensureAvailabilityEligible(auth.driver);
  if (eligibilityError) return NextResponse.json({ active: false, presence: null });

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
  const eligibilityError = await ensureAvailabilityEligible(auth.driver);
  if (eligibilityError) return eligibilityError;

  let body: { lat?: number; lng?: number; visibility?: string; hours?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const coordinates = parseCoordinates(body);
  if (!coordinates) return NextResponse.json({ error: 'Valid lat/lng are required.' }, { status: 400 });
  const visibility = typeof body.visibility === 'string' && VISIBILITIES.has(body.visibility) ? body.visibility : 'private';
  const requestedHours = typeof body.hours === 'number' && Number.isFinite(body.hours) ? body.hours : 4;
  const hours = Math.min(MAX_HOURS, Math.max(1, Math.round(requestedHours)));
  const now = new Date();
  const availableUntil = new Date(now.getTime() + hours * 60 * 60_000).toISOString();

  const { error } = await supabaseAdmin!.from('driver_availability_presence').upsert({
    driver_id: auth.driver.id,
    company_id: auth.driver.company_id ?? null,
    visibility,
    exact_lat: coordinates.lat,
    exact_lng: coordinates.lng,
    exchange_lat: roundedForExchange(coordinates.lat),
    exchange_lng: roundedForExchange(coordinates.lng),
    available_until: availableUntil,
    recorded_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'driver_id' });
  if (error) return NextResponse.json({ error: 'Availability presence could not be updated.' }, { status: 500 });
  return NextResponse.json({ ok: true, visibility, available_until: availableUntil });
}

export async function PUT(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;
  const eligibilityError = await ensureAvailabilityEligible(auth.driver);
  if (eligibilityError) return eligibilityError;

  let body: { lat?: number; lng?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const coordinates = parseCoordinates(body);
  if (!coordinates) return NextResponse.json({ error: 'Valid lat/lng are required.' }, { status: 400 });

  const { data: presence, error: presenceError } = await supabaseAdmin!
    .from('driver_availability_presence')
    .select('available_until')
    .eq('driver_id', auth.driver.id)
    .maybeSingle();
  if (presenceError) return NextResponse.json({ error: 'Availability presence could not be verified.' }, { status: 500 });
  if (!presence?.available_until || new Date(presence.available_until).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Availability sharing is no longer active.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin!
    .from('driver_availability_presence')
    .update({
      exact_lat: coordinates.lat,
      exact_lng: coordinates.lng,
      exchange_lat: roundedForExchange(coordinates.lat),
      exchange_lng: roundedForExchange(coordinates.lng),
      recorded_at: now,
      updated_at: now,
    })
    .eq('driver_id', auth.driver.id);
  if (error) return NextResponse.json({ error: 'Availability location could not be refreshed.' }, { status: 500 });
  return NextResponse.json({ ok: true, available_until: presence.available_until });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedDriver(request);
  if ('error' in auth) return auth.error;
  const { error } = await supabaseAdmin!.from('driver_availability_presence').delete().eq('driver_id', auth.driver.id);
  if (error) return NextResponse.json({ error: 'Availability presence could not be stopped.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
