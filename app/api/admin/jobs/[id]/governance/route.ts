import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status });

const actionSchema = z.object({
  action: z.enum(['publish_to_exchange', 'hide_from_exchange', 'cancel']),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.action === 'cancel' && !value.reason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: 'A cancellation reason is required.',
    });
  }
});

type JobRow = {
  id: string;
  company_id: string;
  created_by: string | null;
  status: string | null;
  current_status: string | null;
  exchange_visibility: string | null;
};

const companyStatus = (value: unknown) => {
  if (Array.isArray(value)) return String(value[0]?.status ?? '').trim().toLowerCase();
  if (value && typeof value === 'object') return String((value as { status?: unknown }).status ?? '').trim().toLowerCase();
  return '';
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return respond(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: parsed.error.issues[0]?.message ?? 'Invalid governance action.',
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { id: jobId } = await params;
  const { data: rawJob, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, created_by, status, current_status, exchange_visibility')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!rawJob) return respond(404, { error: 'Job not found.' });

  const job = rawJob as JobRow;
  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('company_memberships')
      .select('role_in_company, status, companies!inner(status)')
      .eq('company_id', job.company_id)
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', authData.user.id)
      .maybeSingle(),
  ]);

  if (membershipError) return respond(500, { error: membershipError.message });
  if (profileError) return respond(500, { error: profileError.message });

  const role = String(membership?.role_in_company ?? '').trim().toLowerCase();
  const profileRole = String(profile?.role ?? '').trim().toLowerCase();
  const activeCompany = companyStatus(membership?.companies) === 'active';
  const operatorRole = ['owner', 'admin', 'dispatcher', 'member'].includes(role);
  const operator = Boolean(membership) && activeCompany && profileRole !== 'driver' && operatorRole;
  const admin = operator && ['owner', 'admin'].includes(role);
  const creatorOrAdmin = operator && (job.created_by === authData.user.id || admin);

  if (parsed.data.action === 'publish_to_exchange' || parsed.data.action === 'hide_from_exchange') {
    if (!admin) {
      return respond(403, { error: 'Company Owner or Admin access is required to publish or hide a load.' });
    }
  } else if (!creatorOrAdmin) {
    return respond(403, { error: 'Only the job creator or a Company Owner/Admin can cancel this job.' });
  }

  const rpcAction = parsed.data.action === 'cancel' ? 'force_cancel' : parsed.data.action;
  const { data: mutationResult, error: mutationError } = await supabaseAdmin.rpc(
    'apply_marketplace_governance_action',
    {
      p_actor_user_id: authData.user.id,
      p_job_id: jobId,
      p_action: rpcAction,
      p_reason: parsed.data.reason?.trim() || null,
    },
  );

  if (mutationError) {
    const status = mutationError.code === 'P0002'
      ? 404
      : ['23514', '23502', 'P0001'].includes(String(mutationError.code ?? ''))
        ? 409
        : 500;
    return respond(status, { error: mutationError.message });
  }

  const result = Array.isArray(mutationResult) ? mutationResult[0] : mutationResult;
  const { data: refreshed, error: refreshError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, status, current_status, exchange_visibility, exchange_posted_at, updated_at')
    .eq('id', jobId)
    .maybeSingle();
  if (refreshError) return respond(500, { error: refreshError.message });

  return respond(200, {
    success: true,
    action: parsed.data.action,
    governanceResult: result,
    job: refreshed,
  });
}
