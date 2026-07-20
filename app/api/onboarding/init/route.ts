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
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return json(401, { error: 'Unauthorized: invalid token.' });
  }

  let payload: z.infer<typeof requestSchema> = {};
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return json(400, { error: 'Invalid request payload.' });
    payload = parsed.data;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const authUser = authData.user;
  const accountType = normalizeOnboardingAccountType(
    resolveOnboardingAccountTypeFromMetadata(
      (authUser.user_metadata ?? null) as Record<string, unknown> | null,
      (authUser.app_metadata ?? null) as Record<string, unknown> | null
    )
  );

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, account_type, token_hash, token_expires_at, token_activated_at, token_last_sent_at')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (existingError) return json(500, { error: existingError.message });

  const now = new Date();
  const normalizedExistingStatus = normalizeOnboardingStatus(existing?.status);
  const tokenExpired = Boolean(
    existing?.token_expires_at && new Date(existing.token_expires_at).getTime() <= now.getTime()
  );
  const shouldRegenerateToken =
    payload.forceRegenerateToken === true ||
    !existing ||
    !existing.token_hash ||
    tokenExpired;

  let invitationUrl: string | null = null;
  const row: Record<string, unknown> = {
    user_id: authUser.id,
    email: authUser.email ?? 'unknown@xdrive.local',
    account_type: accountType,
    status: normalizedExistingStatus,
    last_activity_at: now.toISOString(),
    current_step: normalizedExistingStatus === 'approved' ? 'workspace_unlocked' : (existing ? undefined : 'account_type_wizard'),
    completion_percentage: normalizedExistingStatus === 'approved' ? 100 : (existing ? undefined : 5),
  };

  if (shouldRegenerateToken) {
    const ttlHours = await resolveOnboardingTokenTtlHours(supabaseAdmin);
    const onboardingToken = generateOnboardingToken();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
    invitationUrl = buildOnboardingUrl(onboardingToken, accountType);
    row.token_hash = hashOnboardingToken(onboardingToken);
    row.token_expires_at = expiresAt;
    row.token_activated_at = null;
    row.token_last_sent_at = now.toISOString();
  }

  Object.keys(row).forEach((key) => {
    if (row[key] === undefined) delete row[key];
  });

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('onboarding_applications')
    .upsert(row, { onConflict: 'user_id' })
    .select('id, status, account_type, token_expires_at')
    .single();

  if (upsertError) return json(500, { error: upsertError.message });

  if (shouldRegenerateToken && invitationUrl) {
    const { error: notificationError } = await supabaseAdmin
      .from('notification_events')
      .insert({
        event_type: 'onboarding_invite',
        entity_type: 'onboarding_application',
        entity_id: upserted.id,
        recipient_user_id: authUser.id,
        idempotency_key: `onboarding-invite:${upserted.id}:${upserted.token_expires_at}`,
        payload: {
          onboarding_url: invitationUrl,
          account_type: upserted.account_type,
          onboarding_application_id: upserted.id,
          token_expires_at: upserted.token_expires_at,
        },
      });

    if (notificationError && notificationError.code !== '23505') {
      return json(500, { error: notificationError.message });
    }
  }

  return json(200, {
    onboardingApplicationId: upserted.id,
    status: upserted.status,
    accountType: upserted.account_type,
    onboardingUrl: '/onboarding/resume',
    tokenExpiresAt: upserted.token_expires_at,
    invitationRegenerated: shouldRegenerateToken,
    resumeAllowed: true,
  });
}
