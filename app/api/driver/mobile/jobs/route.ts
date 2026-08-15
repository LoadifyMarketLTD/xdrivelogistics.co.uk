import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../_lib/platformFlags';
import { driverJobStatusesForScope } from '../../../../../lib/jobs/jobLifecyclePresentation';
import { isDriverContext, jobSelect, mapJob, MobileJobRow, requireDriver, respond } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') || 'active';
  const limit = Math.min(Number(searchParams.get('limit') ?? 100) || 100, 250);
  const statusList = driverJobStatusesForScope(scope);

  let query = supabaseAdmin
    .from('jobs')
    .select(jobSelect)
    .eq('assigned_driver_id', driver.driverId)
    .order(scope === 'completed' ? 'updated_at' : 'pickup_datetime', { ascending: scope !== 'completed' })
    .limit(limit);

  // `all` is intentionally assignment-gated rather than Marketplace-gated. It
  // exists for authorised execution history and does not change job lifecycle.
  if (statusList) {
    query = query.in('status', [...statusList]);
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  return respond(200, {
    scope,
    jobs: ((data ?? []) as unknown as MobileJobRow[]).map(mapJob),
  });
}
