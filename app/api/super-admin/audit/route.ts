import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformOwner } from '../../_lib/platformAuth';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function GET(request: NextRequest) {
  const access = await requirePlatformOwner(request);
  if (!access.ok) return respond(access.failure.status, { error: access.failure.error });
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get('limit') ?? 200);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500) : 200;

  const { data, error } = await supabaseAdmin
    .from('owner_audit_log')
    .select('id, actor_user_id, target_company_id, action_type, old_status, new_status, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return respond(503, { error: 'Platform audit history is temporarily unavailable.', detail: error.message, degraded: true });

  const rows = data ?? [];
  const companyIds = Array.from(new Set(rows.map((row) => row.target_company_id as string).filter(Boolean)));
  const { data: companies, error: companiesError } = companyIds.length > 0
    ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
    : { data: [], error: null };

  if (companiesError) return respond(503, { error: 'Platform audit company context is temporarily unavailable.', detail: companiesError.message, degraded: true });

  const nameById = new Map(((companies ?? []) as { id: string; name: string }[]).map((company) => [company.id, company.name]));
  return respond(200, {
    rows: rows.map((row) => ({
      ...row,
      company_name: nameById.get(row.target_company_id as string) ?? 'Unknown',
    })),
    summary: {
      total: rows.length,
      approvals: rows.filter((row) => ['approve_company', 'company_approved'].includes(row.action_type)).length,
      suspensions: rows.filter((row) => ['suspend_company', 'company_suspended'].includes(row.action_type)).length,
      reinstatements: rows.filter((row) => ['reinstate_company', 'company_reinstated'].includes(row.action_type)).length,
      rejections: rows.filter((row) => ['reject_company', 'company_rejected'].includes(row.action_type)).length,
    },
    degraded: false,
  });
}
