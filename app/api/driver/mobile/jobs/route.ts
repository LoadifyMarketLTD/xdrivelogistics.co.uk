import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../_lib';

const scopes: Record<string, string[]> = {
  active: ['awarded', 'allocated', 'accepted', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'on_my_way_to_delivery', 'on_site_delivery', 'collected', 'in_transit'],
  upcoming: ['awarded', 'allocated'],
  completed: ['delivered', 'invoiced', 'paid'],
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'active';
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 250);

  let query = supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('assigned_driver_id', driver.driverId)
    .order(scope === 'completed' ? 'updated_at' : 'pickup_datetime', { ascending: scope !== 'completed' })
    .limit(limit);

  const statusList = scopes[scope] ?? scopes.active;
  query = query.in('status', statusList);

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  return respond(200, {
    scope,
    jobs: ((data ?? []) as unknown as MobileJobRow[]).map(mapJob),
  });
}
