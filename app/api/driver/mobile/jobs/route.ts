import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

async function resolveDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const { data: authData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: driverRow } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return {
    userId: authData.user.id,
    driverId: driverRow.id as string,
    companyId: driverRow.company_id as string,
  };
}

/**
 * GET /api/driver/mobile/jobs?scope=active|upcoming|completed
 *
 * Returns jobs for the authenticated driver.
 * - active:    status in (allocated, collected, in_transit)
 * - upcoming:  status = awarded (driver has been assigned but not yet started)
 * - completed: status in (delivered, invoiced, paid)
 * Defaults to returning all three groups when scope is omitted.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const scope = request.nextUrl.searchParams.get('scope') ?? 'all';

  const statusMap: Record<string, string[]> = {
    active: ['allocated', 'collected', 'in_transit'],
    upcoming: ['awarded'],
    completed: ['delivered', 'invoiced', 'paid'],
    all: ['awarded', 'allocated', 'collected', 'in_transit', 'delivered', 'invoiced', 'paid'],
  };

  const statuses = statusMap[scope] ?? statusMap.all;

  const { data: jobs, error } = await supabaseAdmin
    .from('jobs')
    .select(
      `id, status, current_status,
       pickup_location, pickup_datetime,
       delivery_location, delivery_datetime,
       pickup_lat, pickup_lng, delivery_lat, delivery_lng,
       vehicle_type, load_details,
       budget_amount, currency,
       pod_required, pod_generated,
       assigned_driver_id,
       awarded_carrier_company_id,
       company_id,
       updated_at, created_at`
    )
    .eq('assigned_driver_id', driver.driverId)
    .in('status', statuses)
    .order('pickup_datetime', { ascending: true })
    .limit(100);

  if (error) return respond(500, { error: error.message });

  return respond(200, { jobs: jobs ?? [] });
}
