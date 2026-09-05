import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const OPEN_JOB_STATUSES = [
  'draft', 'received', 'posted', 'quoted', 'awarded', 'allocated', 'accepted', 'assigned',
  'open', 'OPEN', 'in_progress', 'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup',
  'loaded', 'collected', 'in_transit', 'on_my_way_to_delivery', 'on_site_delivery',
];
const OUTSTANDING_PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'overdue', 'disputed'];
const NON_COLLECTIBLE_INVOICE_STATUSES = ['paid', 'void'];
const COMPLIANCE_REVIEW_STATUSES = ['pending', 'rejected'];
const MISSING_INTERNAL_ACCOUNT_COLUMN_CODES = new Set(['42703', 'PGRST204']);

type QueryError = { code?: string; message: string } | null;
type CountResult = { count: number | null; error: QueryError };

const countValue = (result: CountResult) => result.count as number;

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const [
    companiesTotalResult,
    companiesActiveResult,
    companiesSuspendedResult,
    companiesPendingResult,
    driversTotalResult,
    internalProfilesResult,
    jobsTotalResult,
    jobsOpenResult,
    jobsDeliveredResult,
    invoicesTotalResult,
    outstandingInvoicesResult,
    nonCollectibleOutstandingInvoicesResult,
    driverComplianceResult,
    vehicleComplianceResult,
  ] = await Promise.all([
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('user_id').eq('is_internal_account', true),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).in('status', OPEN_JOB_STATUSES),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).in('payment_status', OUTSTANDING_PAYMENT_STATUSES),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).in('payment_status', OUTSTANDING_PAYMENT_STATUSES).in('status', NON_COLLECTIBLE_INVOICE_STATUSES),
    supabaseAdmin.from('driver_documents').select('id', { count: 'exact', head: true }).in('status', COMPLIANCE_REVIEW_STATUSES),
    supabaseAdmin.from('vehicle_documents').select('id', { count: 'exact', head: true }).in('status', COMPLIANCE_REVIEW_STATUSES),
  ]);

  const requiredResults: Array<[string, CountResult]> = [
    ['companies_total', companiesTotalResult],
    ['companies_active', companiesActiveResult],
    ['companies_suspended', companiesSuspendedResult],
    ['companies_pending', companiesPendingResult],
    ['drivers_total', driversTotalResult],
    ['jobs_total', jobsTotalResult],
    ['jobs_open', jobsOpenResult],
    ['jobs_delivered', jobsDeliveredResult],
    ['invoices_total', invoicesTotalResult],
    ['invoices_outstanding', outstandingInvoicesResult],
    ['invoices_non_collectible', nonCollectibleOutstandingInvoicesResult],
    ['driver_compliance', driverComplianceResult],
    ['vehicle_compliance', vehicleComplianceResult],
  ];

  const failed = requiredResults.find(([, result]) => result.error || typeof result.count !== 'number');
  if (failed) {
    return respond(500, {
      error: `${failed[0]}: ${failed[1].error?.message ?? 'exact count unavailable'}`,
      code: 'super_admin_stats_incomplete_snapshot',
    });
  }

  const internalProfilesError = internalProfilesResult.error as QueryError;
  if (internalProfilesError && !MISSING_INTERNAL_ACCOUNT_COLUMN_CODES.has(String(internalProfilesError.code ?? ''))) {
    return respond(500, { error: `internal_profiles: ${internalProfilesError.message}` });
  }

  let driversTotal = countValue(driversTotalResult);
  if (!internalProfilesError) {
    const internalUserIds = Array.from(new Set(
      (internalProfilesResult.data ?? []).map((row) => String(row.user_id ?? '').trim()).filter(Boolean),
    ));
    if (internalUserIds.length > 0) {
      const internalDriversResult = await supabaseAdmin
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .in('user_id', internalUserIds);
      if (internalDriversResult.error || typeof internalDriversResult.count !== 'number') {
        return respond(500, {
          error: `internal_drivers: ${internalDriversResult.error?.message ?? 'exact count unavailable'}`,
          code: 'super_admin_stats_internal_driver_count_unavailable',
        });
      }
      driversTotal = Math.max(0, driversTotal - internalDriversResult.count);
    }
  }

  const outstandingInvoices = countValue(outstandingInvoicesResult);
  const nonCollectibleOutstandingInvoices = countValue(nonCollectibleOutstandingInvoicesResult);

  return respond(200, {
    refreshedAt: new Date().toISOString(),
    companiesTotal: countValue(companiesTotalResult),
    companiesActive: countValue(companiesActiveResult),
    companiesSuspended: countValue(companiesSuspendedResult),
    companiesPending: countValue(companiesPendingResult),
    driversTotal,
    jobsTotal: countValue(jobsTotalResult),
    jobsOpen: countValue(jobsOpenResult),
    jobsDelivered: countValue(jobsDeliveredResult),
    invoicesTotal: countValue(invoicesTotalResult),
    invoicesUnpaid: Math.max(0, outstandingInvoices - nonCollectibleOutstandingInvoices),
    compliancePending: countValue(driverComplianceResult) + countValue(vehicleComplianceResult),
  });
}
