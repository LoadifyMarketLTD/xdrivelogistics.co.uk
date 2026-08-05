import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  // Pagination: page (1-based), limit (max 500)
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limitParam = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? '100') || 100));
  const offset = (pageParam - 1) * limitParam;

  // Filter by action_type
  const actionTypeFilter = searchParams.get('action_type')?.trim() ?? '';

  let query = supabaseAdmin
    .from('owner_audit_log')
    .select('id, actor_user_id, target_company_id, action_type, old_status, new_status, reason, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitParam - 1);

  if (actionTypeFilter) {
    query = query.eq('action_type', actionTypeFilter);
  }

  const { data, error, count } = await query;

  if (error) return respond(500, { error: error.message });

  const rows = data ?? [];

  const companyIds = Array.from(new Set(rows.map((r) => r.target_company_id as string).filter(Boolean)));
  const { data: companies } = companyIds.length > 0
    ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
    : { data: [] };

  const nameById = new Map(
    ((companies ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );

  const totalCount = count ?? rows.length;
  const totalPages = Math.ceil(totalCount / limitParam);

  return respond(200, {
    rows: rows.map((r) => ({
      ...r,
      company_name: nameById.get(r.target_company_id as string) ?? 'Unknown',
    })),
    pagination: {
      page: pageParam,
      limit: limitParam,
      total: totalCount,
      totalPages,
      hasNextPage: pageParam < totalPages,
      hasPrevPage: pageParam > 1,
    },
    summary: {
      total: totalCount,
      approvals: rows.filter((r) => r.action_type === 'company_approved').length,
      suspensions: rows.filter((r) => r.action_type === 'company_suspended').length,
      reinstatements: rows.filter((r) => r.action_type === 'company_reinstated').length,
      rejections: rows.filter((r) => r.action_type === 'company_rejected').length,
    },
  });
}
