import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { normalizeOnboardingAccountType, normalizeOnboardingStatus } from '../../../_lib/onboarding';
import { syncOnboardingAccess } from '../../../onboarding/_lib/accessSync';

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

  const { data: reviewResult, error: reviewError } = await supabaseAdmin.rpc('review_onboarding_application_atomic', {
    p_application_id: id,
    p_actor_user_id: authData.user.id,
    p_action: parsed.data.action,
    p_notes: parsed.data.notes ?? null,
  });

  if (reviewError) {
    const statusCode = reviewError.code === 'P0002' ? 404 : reviewError.code === '23514' ? 409 : 500;
    return respond(statusCode, { error: reviewError.message });
  }

  const reviewed = Array.isArray(reviewResult) ? reviewResult[0] : reviewResult;
  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('user_id, account_type, status, company_id')
    .eq('id', id)
    .single();

  if (applicationError) {
    return respond(500, {
      error: 'The review was saved, but the updated onboarding application could not be loaded.',
      details: applicationError.message,
    });
  }

  const accountType = normalizeOnboardingAccountType(application.account_type);
  if (!accountType) {
    return respond(409, {
      error: 'The review was saved, but the onboarding account type is unsupported.',
      code: 'unsupported_onboarding_role',
    });
  }

  const accessSyncError = await syncOnboardingAccess(supabaseAdmin, {
    userId: application.user_id,
    accountType,
    status: normalizeOnboardingStatus(application.status),
    companyId: application.company_id ?? reviewed?.company_id ?? null,
  });
  if (accessSyncError) {
    return respond(500, {
      error: 'The review was saved, but account access could not be synchronized.',
      details: accessSyncError.message,
    });
  }

  return respond(200, {
    success: true,
    onboardingApplicationId: reviewed?.onboarding_application_id ?? id,
    status: reviewed?.status ?? application.status,
  });
}
