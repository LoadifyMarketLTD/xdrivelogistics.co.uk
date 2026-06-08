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
    })
    .eq('id', application.id)
    .select('*')
    .single();

  if (updateError) return respond(500, { error: updateError.message });

  if (parsed.data.action === 'approve') {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id, status')
      .eq('created_by', application.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (company?.id && String(company.status ?? '').toLowerCase() !== 'active') {
      await supabaseAdmin.rpc('set_company_status_governance', {
        p_actor_user_id: authData.user.id,
        p_target_company_id: company.id,
        p_action_type: 'company_approved',
        p_new_status: 'active',
        p_reason: parsed.data.notes?.trim() || 'Onboarding approved',
      });
    }
  }

  return respond(200, {
    success: true,
    onboardingApplicationId: updated.id,
    status: updated.status,
  });
}
