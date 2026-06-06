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
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  const { data, error } = await supabaseAdmin
    .from('owner_audit_log')
    .select('id, actor_user_id, target_company_id, action_type, old_status, new_status, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return respond(500, { error: error.message });

  const rows = data ?? [];

  const companyIds = Array.from(new Set(rows.map((r) => r.target_company_id as string).filter(Boolean)));
  const { data: companies } = companyIds.length > 0
    ? await supabaseAdmin.from('companies').select('id, name').in('id', companyIds)
    : { data: [] };

  const nameById = new Map(
    ((companies ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );

  return respond(200, {
    rows: rows.map((r) => ({
      ...r,
      company_name: nameById.get(r.target_company_id as string) ?? 'Unknown',
    })),
    summary: {
      total: rows.length,
      approvals: rows.filter((r) => r.action_type === 'approve_company').length,
      suspensions: rows.filter((r) => r.action_type === 'suspend_company').length,
      reinstatements: rows.filter((r) => r.action_type === 'reinstate_company').length,
      rejections: rows.filter((r) => r.action_type === 'reject_company').length,
    },
  });
}
