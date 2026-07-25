import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const PENDING_COMPANY_STATUSES = new Set(['pending', 'pending_approval']);
const OPEN_JOB_STATUSES = new Set(['draft', 'posted', 'quoted', 'awarded', 'allocated', 'collected', 'in_transit']);
const MISSING_INTERNAL_ACCOUNT_COLUMN_CODES = new Set(['42703', 'PGRST204']);

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) {
    return respond(401, { error: 'Unauthorized.' });
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized: invalid or expired token.' });
  }

  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  const [companiesResult, driversResult, internalProfilesResult, jobsResult, invoicesResult, driverDocumentsResult, vehicleDocumentsResult] = await Promise.all([
    supabaseAdmin.from('companies').select('status', { count: 'exact' }),
    supabaseAdmin.from('drivers').select('user_id', { count: 'exact' }),
    supabaseAdmin.from('profiles').select('user_id').eq('is_internal_account', true),
    supabaseAdmin.from('jobs').select('status', { count: 'exact' }),
    supabaseAdmin.from('invoices').select('payment_status', { count: 'exact' }),
    supabaseAdmin.from('driver_documents').select('status'),
    supabaseAdmin.from('vehicle_documents').select('status'),
  ]);

  if (companiesResult.error) {
    return respond(500, { error: companiesResult.error.message });
  }
  if (driversResult.error) {
    return respond(500, { error: driversResult.error.message });
  }
  if (
    internalProfilesResult.error &&
    !MISSING_INTERNAL_ACCOUNT_COLUMN_CODES.has(String(internalProfilesResult.error.code ?? ''))
  ) {
    return respond(500, { error: internalProfilesResult.error.message });
  }
  if (jobsResult.error) {
    return respond(500, { error: jobsResult.error.message });
  }
  if (invoicesResult.error) {
    return respond(500, { error: invoicesResult.error.message });
  }
  if (driverDocumentsResult.error) {
    return respond(500, { error: driverDocumentsResult.error.message });
  }
  if (vehicleDocumentsResult.error) {
    return respond(500, { error: vehicleDocumentsResult.error.message });
  }

  const internalUserIds = new Set(
    (internalProfilesResult.data ?? [])
      .map((row) => String(row.user_id ?? '').trim())
      .filter(Boolean)
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

  const jobStatuses = (jobsResult.data ?? []).map((row) => String(row.status ?? '').trim().toLowerCase());
  const jobsOpen = jobStatuses.filter((status) => OPEN_JOB_STATUSES.has(status)).length;
  const jobsDelivered = jobStatuses.filter((status) => status === 'delivered').length;

  const paymentStatuses = (invoicesResult.data ?? []).map((row) => String(row.payment_status ?? '').trim().toLowerCase());
  const paidInvoicesCount = paymentStatuses.filter((status) => status === 'paid').length;
  const invoicesCount = invoicesResult.count ?? paymentStatuses.length;
  const documentStatuses = [
    ...(driverDocumentsResult.data ?? []).map((row) => String(row.status ?? '').trim().toLowerCase()),
    ...(vehicleDocumentsResult.data ?? []).map((row) => String(row.status ?? '').trim().toLowerCase()),
  ];
  const compliancePending = documentStatuses.filter((status) => status === 'pending' || status === 'rejected').length;

  return respond(200, {
    companiesTotal: companiesResult.count ?? companyStatuses.length,
    companiesActive,
    companiesSuspended,
    companiesPending,
    driversTotal: internalProfilesResult.error ? (driversResult.count ?? driverRows.length) : externalDriverCount,
    jobsTotal: jobsResult.count ?? jobStatuses.length,
    jobsOpen,
    jobsDelivered,
    invoicesTotal: invoicesCount,
    invoicesUnpaid: Math.max(0, invoicesCount - paidInvoicesCount),
    compliancePending,
  });
}
