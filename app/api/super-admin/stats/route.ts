import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformOwner } from '../../_lib/platformAuth';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { getEffectiveJobStatus, getInvoiceState, isActiveExecutionStatus } from '../../../../lib/workspaceClassifiers';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const PENDING_COMPANY_STATUSES = new Set(['pending', 'pending_approval']);
const MARKETPLACE_JOB_STATUSES = new Set(['draft', 'posted', 'quoted', 'awarded']);
const OPERATIONAL_JOB_STATUSES = new Set([
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'driver_en_route',
  'on_site_pickup',
  'arrived_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'arrived_delivery',
]);
const DELIVERED_JOB_STATUSES = new Set(['delivered', 'completed', 'invoiced', 'paid']);
const OPEN_DISPUTE_STATUSES = new Set(['open', 'raised', 'pending', 'under_review', 'escalated']);
const MISSING_INTERNAL_ACCOUNT_COLUMN_CODES = new Set(['42703', 'PGRST204']);

export async function GET(request: NextRequest) {
  const access = await requirePlatformOwner(request);
  if (!access.ok) return respond(access.failure.status, { error: access.failure.error });
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const [companiesResult, driversResult, internalProfilesResult, jobsResult, invoicesResult, notificationsResult, disputesResult] = await Promise.all([
    supabaseAdmin.from('companies').select('status', { count: 'exact' }),
    supabaseAdmin.from('drivers').select('user_id, status', { count: 'exact' }),
    supabaseAdmin.from('profiles').select('user_id').eq('is_internal_account', true),
    supabaseAdmin.from('jobs').select('status, current_status', { count: 'exact' }),
    supabaseAdmin.from('invoices').select('status, payment_status, due_date', { count: 'exact' }),
    supabaseAdmin.from('notification_events').select('status', { count: 'exact' }).eq('status', 'failed'),
    supabaseAdmin.from('job_disputes').select('status', { count: 'exact' }),
  ]);

  for (const result of [companiesResult, driversResult, jobsResult, invoicesResult, notificationsResult]) {
    if (result.error) return respond(500, { error: result.error.message });
  }
  if (internalProfilesResult.error && !MISSING_INTERNAL_ACCOUNT_COLUMN_CODES.has(String(internalProfilesResult.error.code ?? ''))) {
    return respond(500, { error: internalProfilesResult.error.message });
  }

  const internalUserIds = new Set(
    (internalProfilesResult.data ?? []).map((row) => String(row.user_id ?? '').trim()).filter(Boolean)
  );
  const driverRows = driversResult.data ?? [];
  const externalDriverCount = driverRows.filter((row) => {
    const userId = String(row.user_id ?? '').trim();
    return !userId || !internalUserIds.has(userId);
  }).length;

  const companyStatuses = (companiesResult.data ?? []).map((row) => String(row.status ?? '').trim().toLowerCase());
  const companiesActive = companyStatuses.filter((status) => status === 'active').length;
  const companiesSuspended = companyStatuses.filter((status) => status === 'suspended').length;
  const companiesPending = companyStatuses.filter((status) => PENDING_COMPANY_STATUSES.has(status)).length;

  const jobRows = jobsResult.data ?? [];
  const effectiveJobStatuses = jobRows.map((row) => getEffectiveJobStatus(row));
  const marketplaceJobs = effectiveJobStatuses.filter((status) => MARKETPLACE_JOB_STATUSES.has(status)).length;
  const operationalJobs = effectiveJobStatuses.filter((status) => OPERATIONAL_JOB_STATUSES.has(status)).length;
  const operationalJobsActive = effectiveJobStatuses.filter((status) => isActiveExecutionStatus(status)).length;
  const jobsDelivered = effectiveJobStatuses.filter((status) => DELIVERED_JOB_STATUSES.has(status)).length;

  const invoiceRows = invoicesResult.data ?? [];
  const invoicesUnpaid = invoiceRows.filter((invoice) => getInvoiceState(invoice).unpaid).length;
  const invoicesOverdue = invoiceRows.filter((invoice) => getInvoiceState(invoice).overdue).length;

  const disputeRows = disputesResult.error ? [] : (disputesResult.data ?? []);
  const disputesOpen = disputeRows.filter((row) => OPEN_DISPUTE_STATUSES.has(String(row.status ?? '').trim().toLowerCase())).length;

  return respond(200, {
    companiesTotal: companiesResult.count ?? companyStatuses.length,
    companiesActive,
    companiesSuspended,
    companiesPending,
    driversTotal: internalProfilesResult.error ? (driversResult.count ?? driverRows.length) : externalDriverCount,
    jobsTotal: jobsResult.count ?? jobRows.length,
    jobsOpen: marketplaceJobs + operationalJobs,
    marketplaceJobs,
    operationalJobs,
    operationalJobsActive,
    jobsDelivered,
    invoicesTotal: invoicesResult.count ?? invoiceRows.length,
    invoicesUnpaid,
    invoicesOverdue,
    notificationFailures: notificationsResult.count ?? notificationsResult.data?.length ?? 0,
    disputesOpen,
    degraded: disputesResult.error ? ['job_disputes'] : [],
  });
}
