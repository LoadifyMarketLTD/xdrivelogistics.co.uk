import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ACCOUNT_TYPE_CONFIG,
  resolveAccountTypeFromMetadata,
  toStoredOnboardingAccountType,
  type AccountType,
} from '../../../../lib/accountTypes';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  buildOnboardingUrl,
  generateOnboardingToken,
  hashOnboardingToken,
  normalizeOnboardingAccountType,
  normalizeOnboardingStatus,
  publicAccountTypeFromStored,
  resolveOnboardingTokenTtlHours,
} from '../../_lib/onboarding';

const requestSchema = z.object({
  account_type: z.enum(['customer', 'broker', 'fleet_operator', 'owner_driver']).optional(),
  forceRegenerateToken: z.boolean().optional(),
}).strict();

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const getAuthenticatedUser = async (request: NextRequest) => {
  if (!supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  return error ? null : data.user;
};

const responseForApplication = (application: {
  id: string;
  status: string | null;
  account_type: string;
  token_expires_at?: string | null;
}, onboardingUrl?: string) => {
  const storedType = normalizeOnboardingAccountType(application.account_type);
  if (!storedType) return null;
  const accountType = publicAccountTypeFromStored(storedType);
  return {
    onboardingApplicationId: application.id,
    status: normalizeOnboardingStatus(application.status),
    accountType,
    onboardingPath: ACCOUNT_TYPE_CONFIG[accountType].onboardingPath,
    ...(onboardingUrl ? { onboardingUrl } : {}),
    tokenExpiresAt: application.token_expires_at ?? null,
    resumeAllowed: true,
  };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const authUser = await getAuthenticatedUser(request);
  if (!authUser) return json(401, { error: 'Unauthorized.' });

  const { data: existing, error } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, account_type, token_expires_at')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!existing) return json(404, { error: 'Onboarding application not found.' });

  const payload = responseForApplication(existing);
  if (!payload) return json(409, { error: 'The saved onboarding account type is unsupported.' });
  return json(200, payload);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const authUser = await getAuthenticatedUser(request);
  if (!authUser) return json(401, { error: 'Unauthorized.' });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Invalid onboarding initialization payload.', details: parsed.error.flatten() });
  }

  const metadataType = resolveAccountTypeFromMetadata(
    (authUser.user_metadata ?? null) as Record<string, unknown> | null,
    (authUser.app_metadata ?? null) as Record<string, unknown> | null
  );
  const requestedType = (parsed.data.account_type ?? metadataType) as AccountType | null;

  if (!requestedType) {
    return json(400, { error: 'A valid account_type is required and could not be resolved from signup metadata.' });
  }
  if (parsed.data.account_type && metadataType && metadataType !== parsed.data.account_type) {
    return json(409, { error: 'The requested account type does not match the signup account type.' });
  }

  const storedType = toStoredOnboardingAccountType(requestedType);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('onboarding_applications')
    .select('id, status, account_type, token_hash, token_expires_at, token_activated_at, current_step, completion_percentage')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (existingError) return json(500, { error: existingError.message });

  if (existing) {
    const existingType = normalizeOnboardingAccountType(existing.account_type);
    if (!existingType || existingType !== storedType) {
      return json(409, { error: 'An onboarding application already exists for a different account type.' });
    }
  }

  const ttlHours = await resolveOnboardingTokenTtlHours(supabaseAdmin);
  const onboardingToken = generateOnboardingToken();
  const tokenExpiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const applicationValues = existing
    ? {
        token_hash: hashOnboardingToken(onboardingToken),
        token_expires_at: tokenExpiresAt,
        token_last_sent_at: now,
        last_activity_at: now,
      }
    : {
        user_id: authUser.id,
        email: authUser.email ?? 'unknown@xdrive.local',
        account_type: storedType,
        workspace_mode: ACCOUNT_TYPE_CONFIG[requestedType].workspaceMode,
        owner_driver_workspace: ACCOUNT_TYPE_CONFIG[requestedType].ownerDriverWorkspace,
        status: 'draft',
        token_hash: hashOnboardingToken(onboardingToken),
        token_expires_at: tokenExpiresAt,
        token_last_sent_at: now,
        last_activity_at: now,
        current_step: 'account_type_confirmed',
        completion_percentage: 5,
        payload: {},
      };

  const query = existing
    ? supabaseAdmin
        .from('onboarding_applications')
        .update(applicationValues)
        .eq('id', existing.id)
    : supabaseAdmin
        .from('onboarding_applications')
        .insert(applicationValues);

  const { data: saved, error: saveError } = await query
    .select('id, status, account_type, token_expires_at')
    .single();

  if (saveError) return json(500, { error: saveError.message });

  const { data: profile, error: profileReadError } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (profileReadError) return json(500, { error: profileReadError.message });
  if (!profile) {
    const config = ACCOUNT_TYPE_CONFIG[requestedType];
    const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
      user_id: authUser.id,
      role: config.appRole,
      status: 'pending',
      is_driver: config.appRole === 'driver',
      updated_at: now,
    });
    if (profileInsertError) return json(500, { error: profileInsertError.message });
  }

  const onboardingUrl = buildOnboardingUrl(onboardingToken, storedType);
  if (!existing || parsed.data.forceRegenerateToken === true) {
    const { error: notificationError } = await supabaseAdmin.from('notification_events').insert({
      event_type: 'onboarding_invite',
      entity_type: 'onboarding_application',
      entity_id: saved.id,
      recipient_user_id: authUser.id,
      payload: {
        onboarding_url: onboardingUrl,
        account_type: storedType,
        onboarding_application_id: saved.id,
        token_expires_at: tokenExpiresAt,
      },
    });
    if (notificationError) {
      console.error('[onboarding] invite notification failed', notificationError.message);
    }
  }

  const payload = responseForApplication(saved, onboardingUrl);
  if (!payload) return json(409, { error: 'The saved onboarding account type is unsupported.' });
  return json(200, payload);
}
