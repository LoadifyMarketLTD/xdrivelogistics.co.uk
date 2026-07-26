import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';
import {
  buildOnboardingUrl,
  generateOnboardingToken,
  hashOnboardingToken,
  isLegacyIndividualDriverOnboardingApplication,
  normalizeOnboardingAccountType,
  normalizeOnboardingStatus,
  resolveOnboardingAccountTypeFromMetadata,
  resolveOnboardingTokenTtlHours,
} from '../../_lib/onboarding';

const requestSchema = z.object({
  forceRegenerateToken: z.boolean().optional(),
});

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

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
  const metadataAccountType = resolveOnboardingAccountTypeFromMetadata(
    (authUser.user_metadata ?? null) as Record<string, unknown> | null,
    (authUser.app_metadata ?? null) as Record<string, unknown> | null
  );

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, account_type, created_at, token_hash, token_expires_at, token_activated_at')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (existingError) return json(500, { error: existingError.message });

  const existingAccountType = normalizeOnboardingAccountType(existing?.account_type);
  if (existing && !existingAccountType) {
    return json(409, {
      error: 'The saved onboarding application has an unsupported account type. Contact XDrive support before continuing.',
      code: 'unsupported_saved_account_type',
    });
  }
  if (
    existingAccountType === 'individual_driver' &&
    existing &&
    !isLegacyIndividualDriverOnboardingApplication(existing.account_type, existing.created_at)
  ) {
    return json(409, {
      error: 'Individual-driver onboarding is legacy-only and unavailable for new registrations.',
      code: 'legacy_individual_driver_onboarding_locked',
    });
  }

  // A valid saved onboarding selection is authoritative. Auth metadata is used
  // only to initialise a new application. Unknown values are never converted
  // to Customer/Shipper.
  const accountType = existingAccountType ?? metadataAccountType;
  if (!accountType) {
    return json(409, {
      error: 'Account type is missing or unsupported. Select a valid account type during registration or contact XDrive support.',
      code: 'missing_or_unsupported_account_type',
    });
  }

  const normalizedExistingStatus = normalizeOnboardingStatus(existing?.status);
  const now = new Date();
  const tokenExpired = Boolean(
    existing?.token_expires_at && new Date(existing.token_expires_at).getTime() <= now.getTime()
  );
  const shouldRegenerateToken =
    normalizedExistingStatus !== 'approved' &&
    (
      payload.forceRegenerateToken === true ||
      !existing ||
      (!existing.token_activated_at && (!existing.token_hash || tokenExpired))
    );

  let invitationUrl: string | null = null;
  const row: Record<string, unknown> = {
    user_id: authUser.id,
    email: authUser.email ?? 'unknown@xdrive.local',
    account_type: accountType,
    status: normalizedExistingStatus,
    last_activity_at: now.toISOString(),
  };

  if (!existing) {
    row.current_step = 'account_type_wizard';
    row.completion_percentage = 5;
  } else if (normalizedExistingStatus === 'approved') {
    row.current_step = 'workspace_unlocked';
    row.completion_percentage = 100;
  }

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
        event_type: payload.forceRegenerateToken
          ? 'onboarding_invite_resent'
          : 'onboarding_invite',
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
