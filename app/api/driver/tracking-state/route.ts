import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);

const statusOf = (job: { current_status?: string | null; status?: string | null }) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Tracking state is temporarily unavailable.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: driver, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id, company_id, status, app_access')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (driverError || !driver || driver.app_access !== true) {
    return NextResponse.json({ should_track: false, reason: 'driver_not_eligible' });
  }

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, assigned_driver_id, awarded_carrier_company_id, current_status, status')
    .eq('assigned_driver_id', driver.id)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (jobsError) return NextResponse.json({ error: 'Assigned jobs could not be verified.' }, { status: 500 });

  const activeJobs = (jobs ?? []).filter((job) => {
    if (!ACTIVE_JOB_STATUSES.has(statusOf(job))) return false;
    if (job.awarded_carrier_company_id && driver.company_id && job.awarded_carrier_company_id !== driver.company_id) return false;
    return true;
  });

  if (activeJobs.length !== 1) {
    return NextResponse.json({
      should_track: false,
      reason: activeJobs.length === 0 ? 'no_active_job' : 'multiple_active_jobs',
    });
  }

  return NextResponse.json({
    should_track: true,
    job_id: activeJobs[0].id,
    status: statusOf(activeJobs[0]),
  });
}
