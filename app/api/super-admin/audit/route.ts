import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const pageParam = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limitParam = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? '100') || 100));
  const offset = (pageParam - 1) * limitParam;
  const actionTypeFilter = searchParams.get('action_type')?.trim() ?? '';

  let query = supabaseAdmin
    .from('owner_audit_log')
    .select('id, actor_user_id, target_type, target_id, target_name, target_company_id, action_type, old_status, new_status, reason, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limitParam - 1);

  if (actionTypeFilter) query = query.eq('action_type', actionTypeFilter);
  const { data, error, count } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = data ?? [];
  const companyIds = Array.from(new Set(rows.map((row) => row.target_company_id as string).filter(Boolean)));
  const companiesResult = companyIds.length > 0
    ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
    : { data: [], error: null };
  if (companiesResult.error) return respond(500, { error: `Failed to resolve audit companies: ${companiesResult.error.message}` });

  const nameById = new Map(
    ((companiesResult.data ?? []) as { id: string; name: string }[]).map((company) => [company.id, company.name]),
  );

  const totalCount = count ?? rows.length;
  const totalPages = Math.ceil(totalCount / limitParam);
  const ACTION_TYPES = ['company_approved', 'company_suspended', 'company_reinstated', 'company_rejected'] as const;

  const summaryResults = await Promise.all(ACTION_TYPES.map(async (actionType) => {
    if (actionTypeFilter && actionTypeFilter !== actionType) return { action: actionType, count: 0, error: null as string | null };
    let summaryQuery = supabaseAdmin!
      .from('owner_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action_type', actionType);
    if (actionTypeFilter) summaryQuery = summaryQuery.eq('action_type', actionTypeFilter);
    const result = await summaryQuery;
    return { action: actionType, count: result.count, error: result.error?.message ?? null };
  }));

  const summaryError = summaryResults.find((result) => result.error)?.error;
  if (summaryError) return respond(500, { error: `Failed to calculate audit summary: ${summaryError}` });
  const summaryByAction = Object.fromEntries(summaryResults.map(({ action, count: summaryCount }) => [action, summaryCount ?? 0]));

  return respond(200, {
    rows: rows.map((row) => ({
      ...row,
      company_name: row.target_company_id ? nameById.get(row.target_company_id as string) ?? 'Unknown company' : null,
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
      approvals: summaryByAction.company_approved ?? 0,
      suspensions: summaryByAction.company_suspended ?? 0,
      reinstatements: summaryByAction.company_reinstated ?? 0,
      rejections: summaryByAction.company_rejected ?? 0,
    },
  });
}
