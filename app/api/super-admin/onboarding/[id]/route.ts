import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  notes: z.string().trim().max(2000).optional(),
});

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid review action.' });
  }

  const { id } = await params;

  const { data: application, error: appError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (appError) return respond(500, { error: appError.message });
  if (!application) return respond(404, { error: 'Onboarding application not found.' });

  const statusByAction: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_changes: 'request_changes',
  };

  const status = statusByAction[parsed.data.action];
  const isApproveAction = parsed.data.action === 'approve';
  const isCustomerApplication = application.account_type === 'customer_shipper';
  let resolvedCompanyId = (application as { company_id?: string | null }).company_id ?? null;

  if (isApproveAction) {
    // Canonical path: onboarding_applications.company_id
    if (!resolvedCompanyId && !isCustomerApplication) {
      // Legacy fallback for pre-link rows only: recover by created_by and immediately backfill company_id.
      const { data: fallbackCompany, error: fallbackError } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('created_by', application.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError) return respond(500, { error: fallbackError.message });
      if (!fallbackCompany?.id) {
        return respond(409, {
          error: 'Approval blocked: onboarding_applications.company_id is missing for this non-customer application.',
        });
      }

      resolvedCompanyId = fallbackCompany.id as string;
      const { error: backfillError } = await supabaseAdmin
        .from('onboarding_applications')
        .update({ company_id: resolvedCompanyId })
        .eq('id', application.id);
      if (backfillError) return respond(500, { error: backfillError.message });
    }

    if (resolvedCompanyId) {
      const { data: company, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('id, status')
        .eq('id', resolvedCompanyId)
        .maybeSingle();
      if (companyError) return respond(500, { error: companyError.message });
      if (!company?.id) {
        return respond(409, {
          error: 'Approval blocked: linked company does not exist for onboarding_applications.company_id.',
        });
      }

      const { data: applicantProfile, error: applicantProfileError } = await supabaseAdmin
        .from('profiles')
        .select('user_id, company_id')
        .eq('user_id', application.user_id)
        .maybeSingle();
      if (applicantProfileError) return respond(500, { error: applicantProfileError.message });
      if (!applicantProfile?.user_id) {
        return respond(409, { error: 'Approval blocked: applicant profile is missing.' });
      }

      if (String(applicantProfile.company_id ?? '') !== String(resolvedCompanyId)) {
        const { error: profileSyncError } = await supabaseAdmin
          .from('profiles')
          .update({ company_id: resolvedCompanyId })
          .eq('user_id', application.user_id);
        if (profileSyncError) return respond(500, { error: profileSyncError.message });
      }

      const { data: membership, error: membershipLookupError } = await supabaseAdmin
        .from('company_memberships')
        .select('id')
        .eq('company_id', resolvedCompanyId)
        .eq('user_id', application.user_id)
        .maybeSingle();
      if (membershipLookupError) return respond(500, { error: membershipLookupError.message });

      if (!membership?.id) {
        const { error: membershipUpsertError } = await supabaseAdmin
          .from('company_memberships')
          .upsert(
            {
              company_id: resolvedCompanyId,
              user_id: application.user_id,
              role_in_company: 'owner',
              status: 'active',
            },
            { onConflict: 'company_id,user_id' },
          );
        if (membershipUpsertError) return respond(500, { error: membershipUpsertError.message });
      }

      if (String(company.status ?? '').toLowerCase() !== 'active') {
        const { error: companyStatusError } = await supabaseAdmin.rpc('set_company_status_governance', {
          p_actor_user_id: authData.user.id,
          p_target_company_id: resolvedCompanyId,
          p_action_type: 'company_approved',
          p_new_status: 'active',
          p_reason: parsed.data.notes?.trim() || 'Onboarding approved',
        });
        if (companyStatusError) return respond(500, { error: companyStatusError.message });
      }
    } else if (!isCustomerApplication) {
      return respond(409, {
        error: 'Approval blocked: onboarding_applications.company_id is required for non-customer applications.',
      });
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: authData.user.id,
      review_notes: parsed.data.notes ?? null,
      current_step: status === 'approved' ? 'workspace_unlocked' : 'pending_review',
      completion_percentage: status === 'approved' ? 100 : application.completion_percentage,
      last_activity_at: new Date().toISOString(),
      ...(resolvedCompanyId ? { company_id: resolvedCompanyId } : {}),
    })
    .eq('id', application.id)
    .select('*')
    .single();

  if (updateError) return respond(500, { error: updateError.message });

  if (isApproveAction) {
    const { error: notificationError } = await supabaseAdmin.from('notification_events').insert({
      event_type: 'onboarding_approved',
      entity_type: 'onboarding_application',
      entity_id: application.id,
      recipient_user_id: application.user_id,
      payload: {
        onboarding_application_id: application.id,
        company_id: resolvedCompanyId,
        approved_by: authData.user.id,
      },
    });
    if (notificationError) return respond(500, { error: notificationError.message });
  }

  return respond(200, {
    success: true,
    onboardingApplicationId: updated.id,
    status: updated.status,
  });
}
