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
  payload_kg: unknown;
  pallets_capacity: unknown;
  has_tail_lift: unknown;
  available_until: unknown;
  recorded_at: unknown;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return NextResponse.json({ error: 'Availability is temporarily unavailable.' }, { status: 503 });
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
      .select('assigned_driver_id, type, payload_kg, pallets_capacity, has_tail_lift')
      .in('assigned_driver_id', eligibleIds)
      .limit(1000),
    companyIds.length
      ? supabaseAdmin
          .from('companies')
          .select('id, name, company_number, company_type, status')
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
        payload_kg: vehicle?.payload_kg ?? null,
        pallets_capacity: vehicle?.pallets_capacity ?? null,
        has_tail_lift: vehicle?.has_tail_lift ?? null,
        available_until: row.available_until,
        recorded_at: row.recorded_at,
      }];
    }
    if (row.visibility !== 'exchange' || !companyId) return [];
    const company = companyById.get(companyId);
    if (!company) return [];

    // Exchange discovery deliberately exposes the trading member and a coarse
    // vehicle/capacity summary, never the driver's identity or exact position.
    // This gives load posters a Vehicles-on-Demand style discovery contract
    // while preserving the stronger XDrive privacy boundary.
    return [{
      company_id: companyId,
      member_name: company.name ?? null,
      member_code: company.company_number ?? null,
      member_type: company.company_type ?? null,
      scope: 'exchange',
      lat: Number(row.exchange_lat),
      lng: Number(row.exchange_lng),
      vehicle_type: vehicle?.type ?? null,
      payload_kg: vehicle?.payload_kg ?? null,
      pallets_capacity: vehicle?.pallets_capacity ?? null,
      has_tail_lift: vehicle?.has_tail_lift ?? null,
      available_until: row.available_until,
      recorded_at: row.recorded_at,
    }];
  });

  return NextResponse.json({ positions }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
