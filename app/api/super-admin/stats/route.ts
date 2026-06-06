import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

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

  const [
    companiesTotal,
    companiesActive,
    companiesSuspended,
    companiesPendingApproval,
    companiesPendingLegacy,
    driversTotal,
    jobsTotal,
    jobsOpen,
    jobsDelivered,
    invoicesTotal,
    paidInvoices,
  ] = await Promise.all([
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'suspended'),
    // 'pending_approval' is the canonical value; may fail if the enum doesn't include it yet
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    // Fallback: 'pending' is the legacy enum value on some deployments
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['draft', 'posted', 'allocated', 'in_transit']),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'Paid'),
  ]);

  // Combine pending counts: use whichever query succeeded
  const pendingCount =
    (!companiesPendingApproval.error ? (companiesPendingApproval.count ?? 0) : 0) +
    (!companiesPendingLegacy.error ? (companiesPendingLegacy.count ?? 0) : 0);

  const invoicesCount = invoicesTotal.count ?? 0;
  const paidInvoicesCount = paidInvoices.count ?? 0;

  return respond(200, {
    companiesTotal: companiesTotal.count ?? 0,
    companiesActive: companiesActive.count ?? 0,
    companiesSuspended: companiesSuspended.count ?? 0,
    companiesPending: pendingCount,
    driversTotal: driversTotal.count ?? 0,
    jobsTotal: jobsTotal.count ?? 0,
    jobsOpen: jobsOpen.count ?? 0,
    jobsDelivered: jobsDelivered.count ?? 0,
    invoicesTotal: invoicesCount,
    invoicesUnpaid: Math.max(0, invoicesCount - paidInvoicesCount),
  });
}
