import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  buildOnboardingUrl,
  generateOnboardingToken,
  hashOnboardingToken,
  normalizeOnboardingAccountType,
  normalizeOnboardingStatus,
  resolveOnboardingAccountTypeFromMetadata,
  resolveOnboardingTokenTtlHours,
} from '../../_lib/onboarding';

const requestSchema = z.object({
  forceRegenerateToken: z.boolean().optional(),
});

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) {
    return json(401, { error: 'Unauthorized.' });
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized: invalid token.' });
  }

  const authUser = authData.user;

  let payload: z.infer<typeof requestSchema> = {};
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return json(400, { error: 'Invalid request payload.' });
    payload = parsed.data;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const accountType = normalizeOnboardingAccountType(
    resolveOnboardingAccountTypeFromMetadata(
      (authUser.user_metadata ?? null) as Record<string, unknown> | null,
      (authUser.app_metadata ?? null) as Record<string, unknown> | null
    )
  );

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, token_hash, token_expires_at, token_activated_at')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (existingError) {
    return json(500, { error: existingError.message });
  }

  const ttlHours = await resolveOnboardingTokenTtlHours(supabaseAdmin);
  const now = Date.now();
  const expiresAt = new Date(now + ttlHours * 60 * 60 * 1000).toISOString();

  const onboardingToken = generateOnboardingToken();
  const onboardingTokenHash = hashOnboardingToken(onboardingToken);
  const onboardingUrl = buildOnboardingUrl(onboardingToken, accountType);

  const normalizedExistingStatus = normalizeOnboardingStatus(existing?.status);
  const nextStatus = normalizedExistingStatus === 'approved' ? 'approved' : normalizedExistingStatus;

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('onboarding_applications')
    .upsert(
      {
        user_id: authUser.id,
        email: authUser.email ?? 'unknown@xdrive.local',
        account_type: accountType,
        status: nextStatus,
        token_hash: onboardingTokenHash,
        token_expires_at: expiresAt,
        token_last_sent_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        current_step: normalizedExistingStatus === 'approved' ? 'workspace_unlocked' : 'account_type_wizard',
        completion_percentage: normalizedExistingStatus === 'approved' ? 100 : 5,
      },
      { onConflict: 'user_id' }
    )
    .select('id, status, account_type, token_expires_at')
    .single();

  if (upsertError) {
    return json(500, { error: upsertError.message });
  }

  const shouldSendEmail = payload.forceRegenerateToken === true || !existing || !existing.token_activated_at;

  if (shouldSendEmail) {
    await supabaseAdmin
      .from('notification_events')
      .insert({
        event_type: 'onboarding_invite',
        entity_type: 'onboarding_application',
        entity_id: upserted.id,
        recipient_user_id: authUser.id,
        payload: {
          onboarding_url: onboardingUrl,
          account_type: upserted.account_type,
          onboarding_application_id: upserted.id,
          token_expires_at: upserted.token_expires_at,
        },
      });
  }

  return json(200, {
    onboardingApplicationId: upserted.id,
    status: upserted.status,
    accountType: upserted.account_type,
    onboardingUrl,
    tokenExpiresAt: upserted.token_expires_at,
    resumeAllowed: true,
  });
}
