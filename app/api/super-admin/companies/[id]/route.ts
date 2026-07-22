import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformOwner } from '../../../_lib/platformAuth';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const GOVERNANCE_STATUSES = ['active', 'inactive', 'pending_approval', 'pending', 'rejected', 'suspended'] as const;
type CompanyGovernanceStatus = (typeof GOVERNANCE_STATUSES)[number];
type CompanyGovernanceAction = 'approve' | 'reject' | 'reinstate' | 'suspend';

const ALLOWED_TRANSITIONS: Record<CompanyGovernanceStatus, readonly CompanyGovernanceStatus[]> = {
  active: ['suspended'],
  inactive: [],
  pending_approval: ['active', 'rejected'],
  pending: ['active', 'rejected'],
  rejected: ['pending_approval', 'pending'],
  suspended: ['active'],
};

const ACTION_TO_STATUS: Record<CompanyGovernanceAction, CompanyGovernanceStatus> = {
  approve: 'active', reject: 'rejected', reinstate: 'active', suspend: 'suspended',
};

const ACTION_TO_AUDIT_TYPE: Record<CompanyGovernanceAction, string> = {
  approve: 'company_approved', reject: 'company_rejected', reinstate: 'company_reinstated', suspend: 'company_suspended',
};

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'reinstate', 'suspend']),
  reason: z.string().trim().max(1000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requirePlatformOwner(request);
  if (!access.ok) return respond(access.failure.status, { error: access.failure.error });
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid action. Must be one of: approve, reject, reinstate, suspend.' });
  }

  const { action, reason } = parsed.data;
  const { id: companyId } = await params;
  const { data: currentCompany, error: currentCompanyError } = await supabaseAdmin
    .from('companies')
    .select('id, status')
    .eq('id', companyId)
    .limit(1)
    .maybeSingle();

  if (currentCompanyError) return respond(500, { error: currentCompanyError.message });
  if (!currentCompany) return respond(404, { error: 'Company not found.' });

  const oldStatus = String(currentCompany.status ?? '').trim().toLowerCase() as CompanyGovernanceStatus;
  if (!GOVERNANCE_STATUSES.includes(oldStatus)) {
    return respond(409, { error: `Unsupported current status '${currentCompany.status ?? 'unknown'}'.` });
  }

  const newStatus = ACTION_TO_STATUS[action];
  if (!ALLOWED_TRANSITIONS[oldStatus].includes(newStatus)) {
    return respond(409, { error: `Invalid status transition: ${oldStatus} -> ${newStatus}.` });
  }

  const auditReason = reason?.trim() || `Status changed via super-admin action '${action}'.`;
  const { data: mutationResult, error: mutationError } = await supabaseAdmin.rpc('set_company_status_governance', {
    p_actor_user_id: access.user.id,
    p_target_company_id: companyId,
    p_action_type: ACTION_TO_AUDIT_TYPE[action],
    p_new_status: newStatus,
    p_reason: auditReason,
  });

  if (mutationError) {
    if (mutationError.code === 'P0001' || mutationError.code === '23514') return respond(409, { error: mutationError.message });
    return respond(500, { error: mutationError.message });
  }

  const updated = Array.isArray(mutationResult) ? mutationResult[0] : mutationResult;
  return respond(200, {
    success: true,
    companyId,
    action,
    oldStatus: updated?.old_status ?? oldStatus,
    newStatus: updated?.new_status ?? newStatus,
  });
}
