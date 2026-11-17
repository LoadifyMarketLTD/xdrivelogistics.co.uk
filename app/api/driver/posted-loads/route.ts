import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

export const runtime = 'nodejs';

const error = (status: number, message: string) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Own posted loads and private drafts.
 * This reads through a privileged client ONLY after canonical Owner Driver
 * and active company-owner membership are independently verified.
 * It is not the public / marketplace loads endpoint.
 */
export async function GET(request: NextRequest) {
  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;
  if (!supabaseAdmin || !driver.companyId) return error(403, 'An approved Owner Driver company is required.');

  const { data: ownerDriver, error: driverError } = await supabaseAdmin.from('drivers')
    .select('id,company_id,driver_type,app_access')
    .eq('id', driver.driverId)
    .eq('user_id', driver.userId)
    .eq('company_id', driver.companyId)
    .maybeSingle();
  if (driverError) return error(503, 'Owner Driver access could not be verified.');
  if (!ownerDriver || ownerDriver.driver_type !== 'owner_driver' || ownerDriver.app_access !== true) {
    return error(403, 'Only an approved Owner Driver may view these loads.');
  }

  const { data: membership, error: membershipError } = await supabaseAdmin.from('company_memberships')
    .select('id')
    .eq('user_id', driver.userId)
    .eq('company_id', driver.companyId)
    .eq('role_in_company', 'owner')
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return error(503, 'Company owner membership could not be verified.');
  if (!membership) return error(403, 'Active company owner membership required.');

  const { data: company, error: companyError } = await supabaseAdmin.from('companies')
    .select('id,status')
    .eq('id', driver.companyId)
    .maybeSingle();
  if (companyError) return error(503, 'Company status could not be verified.');
  if (!company || String(company.status).toLowerCase() !== 'active') {
    return error(403, 'Your company must be active.');
  }

  const { data, error: jobsError } = await supabaseAdmin.from('jobs')
    .select('id,company_id,created_by,status,current_status,pickup_location,delivery_location,pickup_datetime,delivery_datetime,created_at,vehicle_type,cargo_type,customer_reference')
    .eq('company_id', driver.companyId)
    .eq('created_by', driver.userId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (jobsError) return error(503, 'Your posted loads could not be loaded.');
  const jobs = (data ?? []).filter(job => job.company_id === driver.companyId && job.created_by === driver.userId);
  return NextResponse.json({ jobs }, { headers: { 'Cache-Control': 'no-store' } });
}
