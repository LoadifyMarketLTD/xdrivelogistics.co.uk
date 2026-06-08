import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { hashOnboardingToken, ONBOARDING_STATUSES } from '../../_lib/onboarding';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const updateSchema = z.object({
  currentStep: z.string().trim().min(1).max(120).optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(ONBOARDING_STATUSES).optional(),
});

const getAuthUser = async (request: NextRequest) => {
  const token = getBearerToken(request);
  if (!token) return null;

  if (!supabaseAdmin) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

const resolveApplication = async ({
  token,
  authUserId,
}: {
  token?: string;
  authUserId?: string;
}) => {
  if (!supabaseAdmin) return { data: null, error: new Error('Admin client unavailable') };

  if (token) {
    const tokenHash = hashOnboardingToken(token);
    return supabaseAdmin
      .from('onboarding_applications')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();
  }

  if (!authUserId) return { data: null, error: null };
  return supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('user_id', authUserId)
    .maybeSingle();
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const authUser = await getAuthUser(request);
  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim() || undefined;

  if (!token && !authUser) {
    return json(401, { error: 'Authentication required.' });
  }

  const { data: app, error } = await resolveApplication({
    token,
    authUserId: authUser?.id,
  });

  if (error) {
    return json(500, { error: error.message });
  }

  if (!app) {
    return json(404, { error: 'Onboarding application not found.' });
  }

  if (authUser && app.user_id !== authUser.id) {
    return json(403, { error: 'Forbidden.' });
  }

  const expiresAt = app.token_expires_at ? new Date(app.token_expires_at).getTime() : null;
  if (token && expiresAt && Date.now() > expiresAt) {
    return json(410, { error: 'Onboarding token expired. Request a new onboarding email.' });
  }

  if (token && app.token_activated_at && !authUser) {
    return json(401, {
      error: 'This onboarding link was already activated. Sign in to resume onboarding.',
      requireLogin: true,
    });
  }

  if (token && !app.token_activated_at) {
    const status = app.status === 'draft' ? 'in_progress' : app.status;
    const { data: activated, error: activationError } = await supabaseAdmin
      .from('onboarding_applications')
      .update({
        token_activated_at: new Date().toISOString(),
        status,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', app.id)
      .select('*')
      .single();

    if (activationError) {
      return json(500, { error: activationError.message });
    }

    return json(200, {
      application: activated,
      resumable: true,
    });
  }

  return json(200, {
    application: app,
    resumable: true,
  });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return json(401, { error: 'Unauthorized.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid onboarding payload.' });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (existingError) {
    return json(500, { error: existingError.message });
  }

  if (!existing) {
    return json(404, { error: 'Onboarding application not found.' });
  }

  const payloadPatch = parsed.data.payload ?? {};

  const nextStatus =
    parsed.data.status && ['draft', 'in_progress', 'request_changes', 'submitted'].includes(parsed.data.status)
      ? parsed.data.status
      : existing.status;

  const updatePayload: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
    status: nextStatus,
    payload: {
      ...(existing.payload as Record<string, unknown>),
      ...payloadPatch,
    },
  };

  if (parsed.data.currentStep) updatePayload.current_step = parsed.data.currentStep;
  if (typeof parsed.data.completionPercentage === 'number') {
    updatePayload.completion_percentage = parsed.data.completionPercentage;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('onboarding_applications')
    .update(updatePayload)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (updateError) {
    return json(500, { error: updateError.message });
  }

  return json(200, { application: updated });
}
