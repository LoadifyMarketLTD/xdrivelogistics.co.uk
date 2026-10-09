import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);
const statusOf = (job: { current_status?: string | null; status?: string | null }) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

type Coordinates = { lat: number; lng: number };

function validCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? { lat: parsedLat, lng: parsedLng } : null;
}

function distanceMiles(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthMiles = 3958.8;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function postcodeHint(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const full = normalized.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  if (full?.[1]) return { kind: 'postcode' as const, value: full[1].replace(/\s+/g, '') };
  const outcode = normalized.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\b/);
  return outcode?.[1] ? { kind: 'outcode' as const, value: outcode[1] } : null;
}

async function resolveSearchCoordinates(value: string): Promise<Coordinates | null> {
  const hint = postcodeHint(value);
  if (!hint) return null;
  try {
    const endpoint = hint.kind === 'postcode'
      ? `https://api.postcodes.io/postcodes/${encodeURIComponent(hint.value)}`
      : `https://api.postcodes.io/outcodes/${encodeURIComponent(hint.value)}`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const payload = await response.json() as { result?: { latitude?: number; longitude?: number } | null };
    return validCoordinates(payload.result?.latitude, payload.result?.longitude);
  } catch {
    return null;
  }
}

type NearbyPosition = {
  driver_id?: unknown;
  company_id: string | null;
  member_name?: unknown;
  member_code?: unknown;
  member_type?: unknown;
  scope: 'fleet' | 'exchange';
  lat: number;
  lng: number;
  vehicle_type: unknown;
  body_type: unknown;
  payload_kg: unknown;
  pallets_capacity: unknown;
  has_tail_lift: unknown;
  available_until: unknown;
  recorded_at: unknown;
  distance_miles?: number | null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return NextResponse.json({ error: 'Availability is temporarily unavailable.' }, { status: 503 });
  const searchPostcode = request.nextUrl.searchParams.get('postcode')?.trim() ?? '';
  const requestedVehicleType = request.nextUrl.searchParams.get('vehicleType')?.trim().toLowerCase() ?? '';
  const requestedBodyType = request.nextUrl.searchParams.get('bodyType')?.trim().toLowerCase() ?? '';
  const requestedScope = request.nextUrl.searchParams.get('scope')?.trim().toLowerCase() ?? 'all';
  const requestedGroupId = request.nextUrl.searchParams.get('groupId')?.trim() ?? '';
  const minPayloadKg = Number(request.nextUrl.searchParams.get('minPayloadKg') ?? '');
  const minPallets = Number(request.nextUrl.searchParams.get('minPallets') ?? '');
  const tailLiftOnly = request.nextUrl.searchParams.get('tailLift') === 'true';
  const requestedRadius = Number(request.nextUrl.searchParams.get('radiusMiles') ?? 100);
  const radiusMiles = Number.isFinite(requestedRadius) ? Math.min(300, Math.max(1, requestedRadius)) : 100;
  const searchOrigin = searchPostcode ? await resolveSearchCoordinates(searchPostcode) : null;
  if (searchPostcode && !searchOrigin) {
    return NextResponse.json({ error: 'Search postcode or outcode could not be resolved.' }, { status: 400 });
  }
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');
  if (membershipError) return NextResponse.json({ error: 'Company access could not be verified.' }, { status: 500 });
  const ownCompanies = new Set((memberships ?? []).map((row) => String(row.company_id ?? '')).filter(Boolean));
  if (ownCompanies.size === 0) return NextResponse.json({ error: 'An active company membership is required.' }, { status: 403 });

  let privateGroupCompanyIds: Set<string> | null = null;
  if (requestedGroupId) {
    const { data: group, error: groupError } = await supabaseAdmin
      .from('network_groups')
      .select('id,owner_company_id,allow_availability_visibility')
      .eq('id', requestedGroupId)
      .maybeSingle();
    if (groupError) return NextResponse.json({ error: 'Private Group visibility could not be verified.' }, { status: 503 });
    if (!group || !ownCompanies.has(String(group.owner_company_id)) || group.allow_availability_visibility !== true) {
      return NextResponse.json({ error: 'Private Group availability is not available to this company.' }, { status: 403 });
    }
    const { data: groupMembers, error: groupMembersError } = await supabaseAdmin
      .from('network_group_members')
      .select('company_id')
      .eq('group_id', requestedGroupId);
    if (groupMembersError) return NextResponse.json({ error: 'Private Group members could not be loaded.' }, { status: 503 });
    privateGroupCompanyIds = new Set((groupMembers ?? []).map((row) => String(row.company_id)).filter(Boolean));
  }

  const { data, error } = await supabaseAdmin
    .from('driver_availability_presence')
    .select('driver_id, company_id, visibility, exact_lat, exact_lng, exchange_lat, exchange_lng, available_until, recorded_at')
    .gt('available_until', new Date().toISOString())
    .in('visibility', ['fleet', 'exchange'])
    .order('recorded_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: 'Availability locations could not be loaded.' }, { status: 500 });

  const presenceRows = data ?? [];
  const driverIds = [...new Set(presenceRows.map((row) => String(row.driver_id ?? '')).filter(Boolean))];
  if (driverIds.length === 0) {
    return NextResponse.json({ positions: [] }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  const { data: drivers, error: driversError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status, app_access, availability_status')
    .in('id', driverIds);
  if (driversError) return NextResponse.json({ error: 'Driver availability eligibility could not be verified.' }, { status: 500 });

  const eligibleDriverIds = new Set((drivers ?? [])
    .filter((driver) => String(driver.status ?? '').toLowerCase() === 'active'
      && driver.app_access === true
      && String(driver.availability_status ?? '').toLowerCase() === 'available')
    .map((driver) => String(driver.id)));

  const eligibleIds = [...eligibleDriverIds];
  if (eligibleIds.length === 0) {
    return NextResponse.json({ positions: [] }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  const companyIds = [...new Set(presenceRows
    .map((row) => String(row.company_id ?? ''))
    .filter(Boolean))];

  const [jobsResult, vehiclesResult, companiesResult] = await Promise.all([
    supabaseAdmin
      .from('jobs')
      .select('assigned_driver_id, current_status, status')
      .in('assigned_driver_id', eligibleIds)
      .limit(2000),
    supabaseAdmin
      .from('vehicles')
      .select('assigned_driver_id, type, body_type, payload_kg, pallets_capacity, has_tail_lift')
      .in('assigned_driver_id', eligibleIds)
      .limit(1000),
    companyIds.length
      ? supabaseAdmin
          .from('companies')
          .select('id, name, xd_id, company_type, status')
          .in('id', companyIds)
          .limit(500)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (jobsResult.error) return NextResponse.json({ error: 'Active job eligibility could not be verified.' }, { status: 500 });
  if (vehiclesResult.error) return NextResponse.json({ error: 'Available vehicle details could not be loaded.' }, { status: 500 });
  if (companiesResult.error) return NextResponse.json({ error: 'Available member details could not be loaded.' }, { status: 500 });

  const driversWithActiveJobs = new Set((jobsResult.data ?? [])
    .filter((job) => job.assigned_driver_id && ACTIVE_JOB_STATUSES.has(statusOf(job)))
    .map((job) => String(job.assigned_driver_id)));

  const vehicleByDriver = new Map((vehiclesResult.data ?? []).map((vehicle) => [String(vehicle.assigned_driver_id), vehicle]));
  const companyById = new Map((companiesResult.data ?? [])
    .filter((company) => String(company.status ?? '').toLowerCase() === 'active')
    .map((company) => [String(company.id), company]));

  const positions = presenceRows.flatMap<NearbyPosition>((row) => {
    const driverId = String(row.driver_id ?? '');
    if (!eligibleDriverIds.has(driverId) || driversWithActiveJobs.has(driverId)) return [];

    const companyId = row.company_id ? String(row.company_id) : null;
    const sameCompany = Boolean(companyId && ownCompanies.has(companyId));
    const vehicle = vehicleByDriver.get(driverId) ?? null;
    if (sameCompany) {
      return [{
        driver_id: row.driver_id,
        company_id: companyId,
        scope: 'fleet',
        lat: Number(row.exact_lat),
        lng: Number(row.exact_lng),
        vehicle_type: vehicle?.type ?? null,
        body_type: vehicle?.body_type ?? null,
        payload_kg: vehicle?.payload_kg ?? null,
        pallets_capacity: vehicle?.pallets_capacity ?? null,
        has_tail_lift: vehicle?.has_tail_lift ?? null,
        available_until: row.available_until,
        recorded_at: row.recorded_at,
      }];
    }
    if (row.visibility !== 'exchange' || !companyId) return [];
    if (privateGroupCompanyIds && !privateGroupCompanyIds.has(companyId)) return [];
    const company = companyById.get(companyId);
    if (!company) return [];

    // Exchange discovery deliberately exposes the trading member and a coarse
    // vehicle/capacity summary, never the driver's identity or exact position.
    // This gives load posters a Vehicles-on-Demand style discovery contract
    // while preserving the stronger XDrive privacy boundary.
    return [{
      company_id: companyId,
      member_name: company.name ?? null,
      member_code: company.xd_id ?? null,
      member_type: company.company_type ?? null,
      scope: 'exchange',
      lat: Number(row.exchange_lat),
      lng: Number(row.exchange_lng),
      vehicle_type: vehicle?.type ?? null,
      body_type: vehicle?.body_type ?? null,
      payload_kg: vehicle?.payload_kg ?? null,
      pallets_capacity: vehicle?.pallets_capacity ?? null,
      has_tail_lift: vehicle?.has_tail_lift ?? null,
      available_until: row.available_until,
      recorded_at: row.recorded_at,
    }];
  });

  const capabilityFiltered = positions.filter((position) => {
    if (requestedScope === 'fleet' || requestedScope === 'exchange') {
      if (position.scope !== requestedScope) return false;
    }
    if (requestedVehicleType && String(position.vehicle_type ?? '').toLowerCase() !== requestedVehicleType) return false;
    if (requestedBodyType && String(position.body_type ?? '').toLowerCase() !== requestedBodyType) return false;
    if (Number.isFinite(minPayloadKg) && minPayloadKg > 0 && Number(position.payload_kg ?? 0) < minPayloadKg) return false;
    if (Number.isFinite(minPallets) && minPallets > 0 && Number(position.pallets_capacity ?? 0) < minPallets) return false;
    if (tailLiftOnly && position.has_tail_lift !== true) return false;
    return true;
  });

  const rangedPositions = capabilityFiltered
    .map((position) => {
      if (!searchOrigin) return position;
      const coordinates = validCoordinates(position.lat, position.lng);
      if (!coordinates) return { ...position, distance_miles: null };
      return { ...position, distance_miles: Number(distanceMiles(searchOrigin, coordinates).toFixed(1)) };
    })
    .filter((position) => !searchOrigin || (position.distance_miles != null && position.distance_miles <= radiusMiles))
    .sort((a, b) => searchOrigin ? (a.distance_miles ?? Number.POSITIVE_INFINITY) - (b.distance_miles ?? Number.POSITIVE_INFINITY) : 0);

  return NextResponse.json({
    positions: rangedPositions,
    search: {
      postcode: searchPostcode || null,
      radiusMiles,
      vehicleType: requestedVehicleType || null,
      bodyType: requestedBodyType || null,
      scope: requestedScope,
      groupId: requestedGroupId || null,
      minPayloadKg: Number.isFinite(minPayloadKg) && minPayloadKg > 0 ? minPayloadKg : null,
      minPallets: Number.isFinite(minPallets) && minPallets > 0 ? minPallets : null,
      tailLiftOnly,
      resolved: searchPostcode ? Boolean(searchOrigin) : null,
    },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
