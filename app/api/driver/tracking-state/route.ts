import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver } from '../mobile/_lib';

const ACTIVE_JOB_STATUSES = new Set([
  'allocated', 'accepted', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'arrived_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_route_delivery', 'on_site_delivery', 'arrived_delivery',
]);

const statusOf = (job: { current_status?: string | null; status?: string | null }) =>
  String(job.current_status ?? job.status ?? '').trim().toLowerCase();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { data: jobs, error: jobsError } = await supabaseAdmin!
    .from('jobs')
    .select('id, assigned_driver_id, assigned_company_id, awarded_carrier_company_id, current_status, status')
    .eq('assigned_driver_id', driver.driverId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (jobsError) return NextResponse.json({ error: 'Assigned jobs could not be verified.' }, { status: 500 });

  const activeJobs = (jobs ?? []).filter((job) => {
    if (!ACTIVE_JOB_STATUSES.has(statusOf(job))) return false;
    // Match the authoritative lifecycle RPC tenant boundary. The awarded carrier
    // is canonical when present; assigned_company_id is the fleet/legacy fallback.
    // A carrier-bound job must never keep GPS enabled for a driver outside it.
    const carrierCompanyId = job.awarded_carrier_company_id ?? job.assigned_company_id;
    if (carrierCompanyId && carrierCompanyId !== driver.companyId) return false;
    return true;
  });

  if (activeJobs.length !== 1) {
    return NextResponse.json({ should_track: false, reason: activeJobs.length === 0 ? 'no_active_job' : 'multiple_active_jobs' });
  }

  return NextResponse.json({ should_track: true, job_id: activeJobs[0].id, status: statusOf(activeJobs[0]) });
}
