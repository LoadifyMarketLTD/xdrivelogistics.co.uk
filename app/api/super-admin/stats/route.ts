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
    companiesPending,
    driversTotal,
    jobsTotal,
    jobsOpen,
    invoicesTotal,
  ] = await Promise.all([
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
    supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }),
  ]);

  return respond(200, {
    companiesTotal: companiesTotal.count ?? 0,
    companiesActive: companiesActive.count ?? 0,
    companiesPending: companiesPending.count ?? 0,
    driversTotal: driversTotal.count ?? 0,
    jobsTotal: jobsTotal.count ?? 0,
    jobsOpen: jobsOpen.count ?? 0,
    invoicesTotal: invoicesTotal.count ?? 0,
  });
}
