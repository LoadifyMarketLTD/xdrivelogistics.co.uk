import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../_lib';

const scopes: Record<string, string[]> = {
  active: [
    'awarded',
    'allocated',
    'accepted',
    'assigned',
    'on_my_way',
    'on_my_way_pickup',
    'on_my_way_to_pickup',
    'arrived_pickup',
    'on_site_pickup',
    'loaded',
    'collected',
    'in_transit',
    'on_my_way_delivery',
    'on_my_way_to_delivery',
    'arrived_delivery',
    'on_site_delivery',
  ],
  upcoming: ['awarded', 'allocated', 'accepted', 'assigned'],
  completed: ['delivered', 'completed', 'invoiced', 'paid'],
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'active';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 100) || 100, 1), 250);
  const statusList = scopes[scope] ?? scopes.active;
  const statuses = statusList.join(',');
  const completedHistory = scope === 'completed';

  let query = supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('assigned_driver_id', driver.driverId)
    .order(completedHistory ? 'updated_at' : 'pickup_datetime', { ascending: !completedHistory })
    .limit(limit);

  // Active/upcoming execution treats current_status as authoritative when present.
  // Full History is deliberately broader: legacy lifecycle status OR current_status
  // can prove completion, so old completed work is not lost because one field is stale.
  query = completedHistory
    ? query.or(`current_status.in.(${statuses}),status.in.(${statuses})`)
    : query.or(`current_status.in.(${statuses}),and(current_status.is.null,status.in.(${statuses}))`);

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  return respond(200, {
    scope,
    jobs: ((data ?? []) as unknown as MobileJobRow[]).map(mapJob),
  });
}
