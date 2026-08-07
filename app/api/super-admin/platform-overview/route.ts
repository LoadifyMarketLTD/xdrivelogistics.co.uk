import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const activeJobStatuses = [
  'awarded',
  'allocated',
  'accepted',
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
];

const resolveOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validator.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  return profile?.role === 'owner' ? authData.user : null;
};

const exactCount = (result: { count: number | null; error: unknown }) =>
  result.error ? null : (result.count ?? 0);

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Platform overview is temporarily unavailable.' });
  }

  const owner = await resolveOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden.' });

  const [
    usersResult,
    companiesResult,
    activeCompaniesResult,
    driversResult,
    activeJobsResult,
    marketplaceLoadsResult,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id', { count: 'exact', head: true }),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).in('status', activeJobStatuses),
    supabaseAdmin
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'posted')
      .is('awarded_carrier_company_id', null),
  ]);

  const metrics = {
    users: exactCount(usersResult),
    companies: exactCount(companiesResult),
    activeCompanies: exactCount(activeCompaniesResult),
    drivers: exactCount(driversResult),
    activeJobs: exactCount(activeJobsResult),
    marketplaceLoads: exactCount(marketplaceLoadsResult),
  };

  const partial = Object.values(metrics).some((value) => value === null);

  return respond(200, {
    refreshedAt: new Date().toISOString(),
    partial,
    metrics,
  });
}
