import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

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
    .select('id, company_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!driverRow) return null;
  return { userId: authData.user.id, driverId: driverRow.id as string, companyId: driverRow.company_id as string };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await resolveDriver(request);
  if (!driver) return respond(401, { error: 'Unauthorized' });

  const { searchParams } = new URL(request.url);
  const vehicle = searchParams.get('vehicle')?.trim();
  const freight = searchParams.get('freight')?.trim();
  const member = searchParams.get('member')?.trim();
  const date = searchParams.get('date')?.trim();
  const minBudget = Number(searchParams.get('minBudget') ?? '');
  const maxBudget = Number(searchParams.get('maxBudget') ?? '');
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 250);

  let query = supabaseAdmin
    .from('jobs')
    .select(
      [
        'id',
        'company_id',
        'status',
        'current_status',
        'pickup_location',
        'pickup_postcode',
        'pickup_datetime',
        'delivery_location',
        'delivery_postcode',
        'delivery_datetime',
        'vehicle_type',
        'cargo_type',
        'budget_amount',
        'currency',
        'client_name',
        'client_phone',
        'load_details',
        'distance_miles',
        'job_distance_miles',
        'exchange_posted_at',
        'companies!jobs_company_id_fkey(name)',
      ].join(',')
    )
    .eq('status', 'posted')
    .not('exchange_posted_at', 'is', null)
    .is('awarded_carrier_company_id', null)
    .order('exchange_posted_at', { ascending: false })
    .limit(limit);

  if (vehicle) query = query.ilike('vehicle_type', `%${vehicle}%`);
  if (freight) query = query.ilike('cargo_type', `%${freight}%`);
  if (member) query = query.or(`client_name.ilike.%${member}%,load_id.ilike.%${member}%`);
  if (date) query = query.gte('pickup_datetime', date);
  if (Number.isFinite(minBudget)) query = query.gte('budget_amount', minBudget);
  if (Number.isFinite(maxBudget)) query = query.lte('budget_amount', maxBudget);

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  return respond(200, {
    rows: data ?? [],
    driver_id: driver.driverId,
  });
}
