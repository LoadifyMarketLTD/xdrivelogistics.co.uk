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
import { syncOnboardingAccess } from '../_lib/accessSync';

const requestSchema = z.object({
  forceRegenerateToken: z.boolean().optional(),
});

const RESEND_COOLDOWN_MS = 60_000;
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const authenticate = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Server auth is not configured.' }), user: null };
  }

  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized.' }), user: null };

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  if (error || !data.user) {
    return { error: json(401, { error: 'Unauthorized: invalid token.' }), user: null };
  }

  return { error: null, user: data.user };
};

const selectExistingApplication = async (userId: string) => supabaseAdmin!
  .from('onboarding_applications')
  .select('id, status, account_type, company_id, token_hash, token_expires_at, token_activated_at, token_last_sent_at')
  .eq('user_id', userId)
  .maybeSingle();

const isInvitationRevoked = (application: {
  token_hash?: string | null;
  token_expires_at?: string | null;
} | null | undefined) => Boolean(
  application &&
  !application.token_hash &&
  application.token_expires_at &&
  new Date(application.token_expires_at).getTime() <= Date.now()
);

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error || !auth.user) return auth.error;

  const { data: existing, error } = await selectExistingApplication(auth.user.id);
  if (error) return json(500, { error: error.message });
  if (!existing) return json(404, { error: 'Onboarding application not found.' });

  const accountType = normalizeOnboardingAccountType(existing.account_type);
  if (!accountType) {
    return json(409, {
      error: 'This account has an unsupported onboarding role. Please contact XDrive support before continuing.',
      code: 'unsupported_onboarding_role',
    });
  }

  const status = normalizeOnboardingStatus(existing.status);
  const accessSyncError = await syncOnboardingAccess(supabaseAdmin!, {
    userId: auth.user.id,
    accountType,
    status,
    companyId: existing.company_id ?? null,
  });
  if (accessSyncError) return json(500, { error: accessSyncError.message });

  const invitationRevoked = isInvitationRevoked(existing);

  return json(200, {
    onboardingApplicationId: existing.id,
    status,
    accountType,
    onboardingUrl: '/onboarding/resume',
    tokenExpiresAt: existing.token_expires_at,
    invitationRevoked,
    resumeAllowed: status === 'approved' || !invitationRevoked,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error || !auth.user) return auth.error;

  let payload: z.infer<typeof requestSchema> = {};
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return json(400, { error: 'Invalid request payload.' });
    payload = parsed.data;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const authUser = auth.user;
  const metadataAccountType = resolveOnboardingAccountTypeFromMetadata(
    (authUser.user_metadata ?? null) as Record<string, unknown> | null,
    (authUser.app_metadata ?? null) as Record<string, unknown> | null
  );

  const { data: existing, error: existingError } = await selectExistingApplication(authUser.id);
  if (existingError) return json(500, { error: existingError.message });

  const existingAccountType = existing
    ? normalizeOnboardingAccountType(existing.account_type)
    : null;
  if (existing && !existingAccountType) {
    return json(409, {
      error: 'This account has an unsupported onboarding role. Please contact XDrive support before continuing.',
      code: 'unsupported_onboarding_role',
    });
  }

  // Existing onboarding data is authoritative. Metadata must never silently
  // reclassify a previously selected driver, fleet, broker or customer account.
  const accountType = existingAccountType ?? metadataAccountType;

  const now = new Date();
  const normalizedExistingStatus = normalizeOnboardingStatus(existing?.status);
  const tokenExpired = Boolean(
    existing?.token_expires_at && new Date(existing.token_expires_at).getTime() <= now.getTime()
  );
  const explicitResend = payload.forceRegenerateToken === true;
  const invitationRevoked = isInvitationRevoked(existing);

  if (explicitResend && existing?.token_last_sent_at) {
    const elapsed = now.getTime() - new Date(existing.token_last_sent_at).getTime();
    if (elapsed >= 0 && elapsed < RESEND_COOLDOWN_MS) {
      return json(429, {
        error: `Please wait ${Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000)} seconds before resending the invitation.`,
        retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      });
    }
  }

  const shouldRegenerateToken =
    explicitResend ||
    !existing ||
    (!invitationRevoked && (!existing.token_hash || tokenExpired));

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

  const { data: upserted, error: upsertError } = await supabaseAdmin!
    .from('onboarding_applications')
    .upsert(row, { onConflict: 'user_id' })
    .select('id, status, account_type, company_id, token_hash, token_expires_at')
    .single();

  if (upsertError) return json(500, { error: upsertError.message });

  const normalizedUpsertedStatus = normalizeOnboardingStatus(upserted.status);
  const accessSyncError = await syncOnboardingAccess(supabaseAdmin!, {
    userId: authUser.id,
    accountType,
    status: normalizedUpsertedStatus,
    companyId: upserted.company_id ?? null,
  });
  if (accessSyncError) return json(500, { error: accessSyncError.message });

  if (shouldRegenerateToken && invitationUrl) {
    const { error: notificationError } = await supabaseAdmin!
      .from('notification_events')
      .insert({
        // The notification worker handles onboarding_invite for both first-send
        // and resend. A payload flag keeps the audit distinction without
        // creating an event type the worker would silently skip.
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
          resent: explicitResend,
        },
      });

    if (notificationError && notificationError.code !== '23505') {
      return json(500, { error: notificationError.message });
    }
  }

  const upsertedInvitationRevoked = isInvitationRevoked(upserted);
  const resumeAllowed = normalizedUpsertedStatus === 'approved' || !upsertedInvitationRevoked;

  return json(200, {
    onboardingApplicationId: upserted.id,
    status: normalizedUpsertedStatus,
    accountType: upserted.account_type,
    onboardingUrl: '/onboarding/resume',
    tokenExpiresAt: upserted.token_expires_at,
    invitationRegenerated: shouldRegenerateToken,
    invitationResent: explicitResend && shouldRegenerateToken,
    invitationRevoked: upsertedInvitationRevoked,
    resumeAllowed,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth.error || !auth.user) return auth.error;

  const { data: existing, error: existingError } = await supabaseAdmin!
    .from('onboarding_applications')
    .select('id, status')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (existingError) return json(500, { error: existingError.message });
  if (!existing) return json(404, { error: 'Onboarding application not found.' });
  if (normalizeOnboardingStatus(existing.status) === 'approved') {
    return json(409, { error: 'An approved onboarding application cannot be revoked.' });
  }

  const revokedAt = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin!
    .from('onboarding_applications')
    .update({
      token_hash: null,
      token_expires_at: revokedAt,
      token_activated_at: null,
      last_activity_at: revokedAt,
      updated_at: revokedAt,
    })
    .eq('id', existing.id)
    .eq('user_id', auth.user.id);

  if (updateError) return json(500, { error: updateError.message });

  return json(200, {
    success: true,
    onboardingApplicationId: existing.id,
    invitationRevoked: true,
    resumeAllowed: false,
  });
}