import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('companies')
    .select('id, name, legal_name, trading_name, company_number, email, status, created_at', { count: 'exact' })
    .eq('company_type', 'broker')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return respond(500, { error: error.message });

  const companies = data ?? [];
  const companyIds = companies.map((company) => String(company.id));
  const [membershipsResult, jobsResult] = companyIds.length
    ? await Promise.all([
        supabaseAdmin.from('company_memberships').select('company_id, status').in('company_id', companyIds),
        supabaseAdmin.from('jobs').select('company_id, status').in('company_id', companyIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (membershipsResult.error) return respond(500, { error: membershipsResult.error.message });
  if (jobsResult.error) return respond(500, { error: jobsResult.error.message });

  const membershipCounts = new Map<string, { total: number; active: number }>();
  for (const row of membershipsResult.data ?? []) {
    const companyId = String(row.company_id);
    const current = membershipCounts.get(companyId) ?? { total: 0, active: 0 };
    current.total += 1;
    if (String(row.status ?? '').toLowerCase() === 'active') current.active += 1;
    membershipCounts.set(companyId, current);
  }

  const jobCounts = new Map<string, { total: number; open: number; delivered: number }>();
  const openStatuses = new Set(['posted', 'allocated', 'accepted', 'in_transit', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'on_my_way_to_delivery', 'on_site_delivery']);
  for (const row of jobsResult.data ?? []) {
    const companyId = String(row.company_id);
    const current = jobCounts.get(companyId) ?? { total: 0, open: 0, delivered: 0 };
    current.total += 1;
    const status = String(row.status ?? '').toLowerCase();
    if (openStatuses.has(status)) current.open += 1;
    if (status === 'delivered') current.delivered += 1;
    jobCounts.set(companyId, current);
  }

  const total = count ?? 0;
  return respond(200, {
    rows: companies.map((company) => ({
      id: company.id,
      name: company.trading_name ?? company.name ?? company.legal_name ?? 'Broker company',
      company_number: company.company_number,
      email: company.email,
      status: company.status,
      created_at: company.created_at,
      memberships_total: membershipCounts.get(String(company.id))?.total ?? 0,
      memberships_active: membershipCounts.get(String(company.id))?.active ?? 0,
      jobs_total: jobCounts.get(String(company.id))?.total ?? 0,
      jobs_open: jobCounts.get(String(company.id))?.open ?? 0,
      jobs_delivered: jobCounts.get(String(company.id))?.delivered ?? 0,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
}
