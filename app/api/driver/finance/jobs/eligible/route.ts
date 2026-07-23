import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

async function resolveFinanceOwner(request: NextRequest) {
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

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', driverRow.company_id)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);

  const role = String(membership?.role_in_company ?? '').toLowerCase();
  return {
    userId: authData.user.id,
    driverId: driverRow.id as string,
    companyId: driverRow.company_id as string,
    canManageFinance: role === 'owner' || role === 'admin',
  };
}

// GET /api/driver/finance/jobs/eligible
// Returns delivered/completed work belonging to or awarded to the carrier company,
// together with any already-created invoice for an idempotent open/refresh action.
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  let driver: Awaited<ReturnType<typeof resolveFinanceOwner>>;
  try {
    driver = await resolveFinanceOwner(request);
  } catch (reason) {
    return respond(500, {
      error: reason instanceof Error ? reason.message : 'Finance access could not be verified.',
    });
  }
  if (!driver) return respond(401, { error: 'Unauthorized.' });
  if (!driver.canManageFinance) {
    return respond(403, { error: 'Company owner or admin access is required to create invoices.' });
  }

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, pickup_location, delivery_location, pickup_datetime, delivery_datetime, budget_amount, client_name, status, customer_reference, updated_at')
    .or(`company_id.eq.${driver.companyId},awarded_carrier_company_id.eq.${driver.companyId}`)
    .in('status', ['delivered', 'completed', 'invoiced'])
    .order('updated_at', { ascending: false })
    .limit(100);

  if (jobsError) return respond(500, { error: jobsError.message });

  const jobIds = (jobs ?? []).map((job) => job.id);
  const { data: invoices, error: invoicesError } = jobIds.length
    ? await supabaseAdmin
      .from('invoices')
      .select('id, job_id, invoice_number, status, amount, client_name, delivery_state')
      .eq('company_id', driver.companyId)
      .in('job_id', jobIds)
    : { data: [], error: null };

  if (invoicesError) return respond(500, { error: invoicesError.message });

  const invoiceByJob = new Map(
    (invoices ?? []).map((invoice) => [invoice.job_id as string, invoice])
  );

  return respond(200, {
    rows: (jobs ?? []).map((job) => ({
      ...job,
      invoice: invoiceByJob.get(job.id) ?? null,
    })),
  });
}
