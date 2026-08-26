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
    .select('id, status, app_access, availability_status')
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

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('assigned_driver_id, current_status, status')
    .in('assigned_driver_id', eligibleIds)
    .limit(2000);
  if (jobsError) return NextResponse.json({ error: 'Active job eligibility could not be verified.' }, { status: 500 });

  const driversWithActiveJobs = new Set((jobs ?? [])
    .filter((job) => job.assigned_driver_id && ACTIVE_JOB_STATUSES.has(statusOf(job)))
    .map((job) => String(job.assigned_driver_id)));

  const positions = presenceRows.flatMap((row) => {
    const driverId = String(row.driver_id ?? '');
    if (!eligibleDriverIds.has(driverId) || driversWithActiveJobs.has(driverId)) return [];

    const companyId = row.company_id ? String(row.company_id) : null;
    const sameCompany = Boolean(companyId && ownCompanies.has(companyId));
    if (sameCompany) {
      return [{
        driver_id: row.driver_id,
        scope: 'fleet',
        lat: Number(row.exact_lat),
        lng: Number(row.exact_lng),
        available_until: row.available_until,
        recorded_at: row.recorded_at,
      }];
    }
    if (row.visibility !== 'exchange') return [];
    return [{
      scope: 'exchange',
      lat: Number(row.exchange_lat),
      lng: Number(row.exchange_lng),
      available_until: row.available_until,
      recorded_at: row.recorded_at,
    }];
  });

  return NextResponse.json({ positions }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
