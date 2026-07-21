import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { getOnboardingComplianceReadiness } from '../../../../../lib/server/onboardingCompliance';

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
  approve: 'active',
  reject: 'rejected',
  reinstate: 'active',
  suspend: 'suspended',
};

const ACTION_TO_AUDIT_TYPE: Record<CompanyGovernanceAction, string> = {
  approve: 'company_approved',
  reject: 'company_rejected',
  reinstate: 'company_reinstated',
  suspend: 'company_suspended',
};

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

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'reinstate', 'suspend']),
  reason: z.string().trim().max(1000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized: invalid or expired token.' });
  }

  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
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

  const { data: readiness, error: readinessError } = await getOnboardingComplianceReadiness(supabaseAdmin, {
    companyId,
  });
  if (readinessError) return respond(500, { error: readinessError });

  if (action === 'approve' && readiness?.application) {
    if (!readiness.approvalReady) {
      return respond(409, {
        error: 'Company cannot be approved until all mandatory onboarding documents are uploaded and verified.',
        onboardingApplicationId: readiness.application.id,
        missingDocuments: readiness.missingDocuments,
        unverifiedDocuments: readiness.unverifiedDocuments,
        requiredDocuments: readiness.requiredDocuments,
      });
    }

    const { data: reviewResult, error: reviewError } = await supabaseAdmin.rpc('review_onboarding_application_atomic', {
      p_application_id: readiness.application.id,
      p_actor_user_id: authData.user.id,
      p_action: 'approve',
      p_notes: auditReason,
    });
    if (reviewError) {
      const statusCode = reviewError.code === 'P0002' ? 404 : reviewError.code === '23514' ? 409 : 500;
      return respond(statusCode, { error: reviewError.message });
    }

    const reviewed = Array.isArray(reviewResult) ? reviewResult[0] : reviewResult;
    return respond(200, {
      success: true,
      companyId,
      onboardingApplicationId: readiness.application.id,
      action,
      oldStatus,
      newStatus: reviewed?.status === 'approved' ? 'active' : newStatus,
    });
  }

  const { data: mutationResult, error: mutationError } = await supabaseAdmin.rpc(
    'set_company_status_governance',
    {
      p_actor_user_id: authData.user.id,
      p_target_company_id: companyId,
      p_action_type: ACTION_TO_AUDIT_TYPE[action],
      p_new_status: newStatus,
      p_reason: auditReason,
    }
  );

  if (mutationError) {
    if (mutationError.code === 'P0001' || mutationError.code === '23514') {
      return respond(409, { error: mutationError.message });
    }
    return respond(500, { error: mutationError.message });
  }

  if (action === 'reject' && readiness?.application) {
    const { error: reviewError } = await supabaseAdmin.rpc('review_onboarding_application_atomic', {
      p_application_id: readiness.application.id,
      p_actor_user_id: authData.user.id,
      p_action: 'reject',
      p_notes: auditReason,
    });
    if (reviewError) {
      console.error('[super-admin/companies] company rejected but onboarding status sync failed', {
        companyId,
        onboardingApplicationId: readiness.application.id,
        error: reviewError.message,
      });
    }
  }

  const updated = Array.isArray(mutationResult) ? mutationResult[0] : mutationResult;
  return respond(200, {
    success: true,
    companyId,
    onboardingApplicationId: readiness?.application?.id ?? null,
    action,
    oldStatus: updated?.old_status ?? oldStatus,
    newStatus: updated?.new_status ?? newStatus,
  });
}
