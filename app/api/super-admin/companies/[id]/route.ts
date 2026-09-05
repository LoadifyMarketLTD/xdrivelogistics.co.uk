import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../_lib/platformFlags';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

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
const REASON_REQUIRED_ACTIONS = new Set<CompanyGovernanceAction>(['reject', 'suspend']);

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'reinstate', 'suspend']),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (REASON_REQUIRED_ACTIONS.has(data.action as CompanyGovernanceAction) && !data.reason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: `A reason is required for the '${data.action}' action.` });
  }
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    if (isSuperAdminDeployPreviewReadOnly()) return respond(403, { error: 'Deploy Preview is read-only. Company governance was not changed.' });
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return respond(400, { error: 'Invalid JSON body.' }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, {
      error: parsed.error.issues[0]?.message ?? 'Invalid action.',
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { action, reason } = parsed.data;
  const { id: companyId } = await params;

  if (action === 'suspend' || action === 'reinstate') {
    const suspensionEnabled = await getFeatureFlag(supabaseAdmin, 'company_suspension');
    if (!suspensionEnabled) return respond(503, { error: 'Company suspension controls are currently disabled by a platform feature flag.' });
  }

  const { data: currentCompany, error: currentCompanyError } = await supabaseAdmin
    .from('companies')
    .select('id, status')
    .eq('id', companyId)
    .limit(1)
    .maybeSingle();
  if (currentCompanyError) return respond(500, { error: currentCompanyError.message });
  if (!currentCompany) return respond(404, { error: 'Company not found.' });

  const oldStatus = String(currentCompany.status ?? '').trim().toLowerCase() as CompanyGovernanceStatus;
  if (!GOVERNANCE_STATUSES.includes(oldStatus)) return respond(409, { error: `Unsupported current status '${currentCompany.status ?? 'unknown'}'.` });

  const newStatus = ACTION_TO_STATUS[action];
  if (!ALLOWED_TRANSITIONS[oldStatus].includes(newStatus)) {
    return respond(409, { error: `Invalid status transition: ${oldStatus} -> ${newStatus}.` });
  }

  if (newStatus === 'active') {
    const { error: complianceError } = await supabaseAdmin.rpc('assert_company_compliance_ready', { p_company_id: companyId });
    if (complianceError) {
      if (complianceError.code === '23514' || complianceError.code === 'P0002') {
        return respond(409, { error: complianceError.message, code: 'company_compliance_not_ready' });
      }
      return respond(500, { error: complianceError.message });
    }
  }

  const auditReason = reason?.trim() || `Status changed via super-admin action '${action}'.`;
  const { data: mutationResult, error: mutationError } = await supabaseAdmin.rpc('set_company_status_governance', {
    p_actor_user_id: owner.id,
    p_target_company_id: companyId,
    p_action_type: ACTION_TO_AUDIT_TYPE[action],
    p_new_status: newStatus,
    p_reason: auditReason,
  });

  if (mutationError) {
    if (mutationError.code === 'P0001' || mutationError.code === '23514') return respond(409, { error: mutationError.message });
    if (mutationError.code === '42501') return respond(403, { error: mutationError.message });
    return respond(500, { error: mutationError.message });
  }

  const updated = Array.isArray(mutationResult) ? mutationResult[0] : mutationResult;
  if (!updated) return respond(500, { error: 'Company governance action returned no reconciliation data.' });
  return respond(200, {
    success: true,
    companyId,
    action,
    oldStatus: updated.old_status ?? oldStatus,
    newStatus: updated.new_status ?? newStatus,
  });
}
