import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { normalizeOnboardingStatus } from '../../../_lib/onboarding';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  notes: z.string().trim().max(2000).optional(),
}).strict();

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role, status')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data || data.role !== 'owner' || data.status !== 'active') return null;
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
  if (!profile) {
    return respond(403, { error: 'Forbidden: active owner role required.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid review action.', details: parsed.error.flatten() });
  }

  const { id } = await params;
  const { data: application, error: applicationError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, account_type, company_id')
    .eq('id', id)
    .maybeSingle();

  if (applicationError) return respond(500, { error: applicationError.message });
  if (!application) return respond(404, { error: 'Onboarding application not found.' });
  if (application.account_type === 'customer_shipper') {
    return respond(409, { error: 'Customer onboarding is approved at successful submission and is not reviewed here.' });
  }

  const status = normalizeOnboardingStatus(application.status);
  const action = parsed.data.action;

  if ((status === 'approved' && action === 'approve') || (status === 'rejected' && action === 'reject')) {
    return respond(200, {
      success: true,
      onboardingApplicationId: application.id,
      status,
      idempotent: true,
    });
  }

  const allowed = status === 'under_review'
    ? new Set(['approve', 'reject', 'request_changes'])
    : status === 'rejected'
      ? new Set(['request_changes'])
      : new Set<string>();

  if (!allowed.has(action)) {
    return respond(409, {
      error: `Review action ${action} is not allowed while onboarding is ${status}.`,
    });
  }

  const { data: reviewResult, error: reviewError } = await supabaseAdmin.rpc('review_onboarding_application_atomic', {
    p_application_id: id,
    p_actor_user_id: authData.user.id,
    p_action: action,
    p_notes: parsed.data.notes ?? null,
  });

  if (reviewError) {
    const statusCode = reviewError.code === 'P0002' ? 404 : reviewError.code === '23514' ? 409 : 500;
    return respond(statusCode, { error: reviewError.message });
  }

  const reviewed = Array.isArray(reviewResult) ? reviewResult[0] : reviewResult;
  return respond(200, {
    success: true,
    onboardingApplicationId: reviewed?.onboarding_application_id ?? id,
    status: reviewed?.status ?? null,
  });
}
