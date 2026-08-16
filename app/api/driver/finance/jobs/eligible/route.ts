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
// Returns only jobs this carrier company can truthfully invoice. Exchange/direct
// marketplace work requires an accepted commercial agreement naming this company
// as supplier; private/non-exchange company work keeps the existing direct-job
// invoice contract.
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

  const completedStatuses = ['delivered', 'completed', 'invoiced'];
  const statuses = completedStatuses.join(',');
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, exchange_visibility, pickup_location, delivery_location, pickup_datetime, delivery_datetime, budget_amount, currency, client_name, status, current_status, customer_reference, updated_at')
    .or(`company_id.eq.${driver.companyId},awarded_carrier_company_id.eq.${driver.companyId}`)
    .or(`current_status.in.(${statuses}),and(current_status.is.null,status.in.(${statuses}))`)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (jobsError) return respond(500, { error: jobsError.message });

  const jobIds = (jobs ?? []).map((job) => String(job.id));
  const [invoiceResult, agreementResult] = jobIds.length
    ? await Promise.all([
        supabaseAdmin
          .from('invoices')
          .select('id, job_id, invoice_number, status, amount, client_name, delivery_state')
          .eq('company_id', driver.companyId)
          .in('job_id', jobIds),
        supabaseAdmin
          .from('job_commercial_agreements')
          .select('id, job_id, supplier_company_id, agreed_amount, currency')
          .eq('supplier_company_id', driver.companyId)
          .in('job_id', jobIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  if (invoiceResult.error) return respond(500, { error: invoiceResult.error.message });
  if (agreementResult.error) return respond(500, { error: agreementResult.error.message });

  const invoiceByJob = new Map(
    (invoiceResult.data ?? []).map((invoice) => [String(invoice.job_id), invoice])
  );
  const agreementByJob = new Map(
    (agreementResult.data ?? []).map((agreement) => [String(agreement.job_id), agreement])
  );

  const rows = (jobs ?? []).flatMap((job) => {
    const exchangeVisibility = String(job.exchange_visibility ?? '').toLowerCase();
    const marketplace = exchangeVisibility === 'exchange' || exchangeVisibility === 'direct';
    const agreement = agreementByJob.get(String(job.id)) ?? null;

    // A posting/buyer company must not see its own marketplace load as supplier
    // invoice work merely because jobs.company_id matches its company id.
    if (marketplace && !agreement) return [];
    if (!marketplace && job.company_id !== driver.companyId) return [];

    return [{
      id: job.id,
      pickup_location: job.pickup_location,
      delivery_location: job.delivery_location,
      pickup_datetime: job.pickup_datetime,
      delivery_datetime: job.delivery_datetime,
      client_name: job.client_name,
      customer_reference: job.customer_reference,
      status: job.current_status ?? job.status,
      invoice: invoiceByJob.get(String(job.id)) ?? null,
      commercial_mode: marketplace ? 'marketplace' : 'direct',
      agreed_amount: marketplace ? Number(agreement?.agreed_amount ?? 0) || null : null,
      direct_invoice_amount: marketplace ? null : Number(job.budget_amount ?? 0) || null,
      currency: marketplace ? (agreement?.currency || job.currency || 'GBP') : (job.currency || 'GBP'),
    }];
  });

  return respond(200, { rows });
}
