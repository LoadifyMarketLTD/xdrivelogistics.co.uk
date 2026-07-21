import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ACCOUNT_TYPE_CONFIG,
  resolveAccountTypeFromMetadata,
  toStoredOnboardingAccountType,
  type AccountType,
  type StoredOnboardingAccountType,
} from '../../../../lib/accountTypes';
import { mapAppRole } from '../../../../lib/authRole';
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

type ApplicationSummary = {
  id: string;
  status: string | null;
  account_type: string;
  token_expires_at?: string | null;
};

type EstablishedAccessResult = {
  active: boolean;
  error: string | null;
};

const APPLICATION_SELECT = 'id, status, account_type, token_expires_at';
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const getAuthenticatedUser = async (request: NextRequest) => {
  if (!supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validatorClient.auth.getUser(token);
  return error ? null : data.user;
};

const responseForApplication = (application: ApplicationSummary, onboardingUrl?: string) => {
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

const approvedEstablishedAccountResponse = (accountType: AccountType) => ({
  status: 'approved',
  accountType,
  onboardingPath: ACCOUNT_TYPE_CONFIG[accountType].onboardingPath,
  resumeAllowed: false,
  establishedActiveAccount: true,
});

const validateExistingType = (
  application: ApplicationSummary,
  storedType: StoredOnboardingAccountType
): string | null => {
  const existingType = normalizeOnboardingAccountType(application.account_type);
  if (!existingType) return 'The saved onboarding account type is unsupported.';
  if (existingType !== storedType) {
    return 'An onboarding application already exists for a different account type.';
  }
  return null;
};

const ensurePendingProfile = async (
  userId: string,
  requestedType: AccountType,
  now: string
): Promise<string | null> => {
  if (!supabaseAdmin) return 'Server auth is not configured.';

  const { data: profile, error: profileReadError } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileReadError) return profileReadError.message;
  if (profile) return null;

  const config = ACCOUNT_TYPE_CONFIG[requestedType];
  const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
    user_id: userId,
    role: config.appRole,
    status: 'pending',
    is_driver: config.appRole === 'driver',
    updated_at: now,
  });

  // The auth.users trigger or a concurrent init request may have inserted it
  // after our read. A duplicate is success; all other failures are surfaced.
  if (profileInsertError && profileInsertError.code !== '23505') {
    return profileInsertError.message;
  }
  return null;
};

const getApplicationForUser = async (userId: string) => {
  if (!supabaseAdmin) return { data: null, error: null };
  return supabaseAdmin
    .from('onboarding_applications')
    .select(APPLICATION_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
};

const resolveEstablishedActiveAccess = async (
  userId: string,
  requestedType: AccountType
): Promise<EstablishedAccessResult> => {
  if (!supabaseAdmin) return { active: false, error: 'Server auth is not configured.' };

  const [profileResult, membershipResult, driverResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, status, company_id, is_driver')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('company_memberships')
      .select('company_id, role_in_company, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('drivers')
      .select('company_id, app_access')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const firstError = profileResult.error ?? membershipResult.error ?? driverResult.error;
  if (firstError) return { active: false, error: firstError.message };

  const profile = profileResult.data as {
    role?: string | null;
    status?: string | null;
    company_id?: string | null;
    is_driver?: boolean | null;
  } | null;
  const membership = membershipResult.data as {
    company_id?: string | null;
    role_in_company?: string | null;
    status?: string | null;
  } | null;
  const driver = driverResult.data as {
    company_id?: string | null;
    app_access?: boolean | null;
  } | null;

  if (!profile || profile.status !== 'active' || !membership?.company_id) {
    return { active: false, error: null };
  }

  const companyId = profile.company_id ?? membership.company_id ?? driver?.company_id ?? null;
  if (!companyId || companyId !== membership.company_id) {
    return { active: false, error: null };
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('status, company_type')
    .eq('id', companyId)
    .maybeSingle();
  if (companyError) return { active: false, error: companyError.message };
  if (!company || company.status !== 'active') return { active: false, error: null };

  const profileRole = mapAppRole(profile.role ?? null);
  const companyType = String(company.company_type ?? '').trim().toLowerCase();
  const membershipRole = String(membership.role_in_company ?? '').trim().toLowerCase();

  if (requestedType === 'customer') {
    return {
      active: profileRole === 'customer'
        || ['customer', 'customer_shipper', 'shipper'].includes(companyType),
      error: null,
    };
  }

  if (requestedType === 'broker') {
    return {
      active: profileRole === 'broker'
        || ['broker', 'broker_shipper', 'transport_broker'].includes(companyType),
      error: null,
    };
  }

  if (requestedType === 'fleet_operator') {
    return {
      active: (
        profileRole === 'company_admin'
        || profileRole === 'company_staff'
        || ['carrier', 'fleet', 'fleet_courier', 'courier', 'haulier'].includes(companyType)
      ) && ['owner', 'admin'].includes(membershipRole),
      error: null,
    };
  }

  return {
    active: profileRole === 'driver'
      && profile.is_driver === true
      && driver?.company_id === companyId
      && driver.app_access === true,
    error: null,
  };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Server auth is not configured.' });
  }

  const authUser = await getAuthenticatedUser(request);
  if (!authUser) return json(401, { error: 'Unauthorized.' });

  const { data: existing, error } = await getApplicationForUser(authUser.id);
  if (error) return json(500, { error: error.message });
  if (!existing) return json(404, { error: 'Onboarding application not found.' });

  const payload = responseForApplication(existing as ApplicationSummary);
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
  const now = new Date().toISOString();
  const { data: existingData, error: existingError } = await getApplicationForUser(authUser.id);
  if (existingError) return json(500, { error: existingError.message });

  const existing = existingData as ApplicationSummary | null;
  if (existing) {
    const typeError = validateExistingType(existing, storedType);
    if (typeError) return json(409, { error: typeError });

    const profileError = await ensurePendingProfile(authUser.id, requestedType, now);
    if (profileError) return json(500, { error: profileError });

    // Ordinary registration/callback/login retries are idempotent and must not
    // rotate an already issued token. Token rotation is explicit only.
    if (parsed.data.forceRegenerateToken !== true) {
      const payload = responseForApplication(existing);
      if (!payload) return json(409, { error: 'The saved onboarding account type is unsupported.' });
      return json(200, { ...payload, idempotent: true });
    }
  } else {
    // A pre-existing active account may legitimately predate onboarding rows.
    // Do not send it backwards into a new draft merely because its metadata is
    // canonical; active profile + company + membership evidence is required.
    const established = await resolveEstablishedActiveAccess(authUser.id, requestedType);
    if (established.error) return json(500, { error: established.error });
    if (established.active) {
      return json(200, approvedEstablishedAccountResponse(requestedType));
    }
  }

  const ttlHours = await resolveOnboardingTokenTtlHours(supabaseAdmin);
  const onboardingToken = generateOnboardingToken();
  const tokenExpiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const tokenHash = hashOnboardingToken(onboardingToken);

  let saved: ApplicationSummary | null = null;
  let created = false;
  let tokenWasRotated = false;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('onboarding_applications')
      .update({
        token_hash: tokenHash,
        token_expires_at: tokenExpiresAt,
        token_last_sent_at: now,
        last_activity_at: now,
      })
      .eq('id', existing.id)
      .select(APPLICATION_SELECT)
      .single();

    if (error) return json(500, { error: error.message });
    saved = data as ApplicationSummary;
    tokenWasRotated = true;
  } else {
    const { data, error } = await supabaseAdmin
      .from('onboarding_applications')
      .insert({
        user_id: authUser.id,
        email: authUser.email ?? 'unknown@xdrive.local',
        account_type: storedType,
        workspace_mode: ACCOUNT_TYPE_CONFIG[requestedType].workspaceMode,
        owner_driver_workspace: ACCOUNT_TYPE_CONFIG[requestedType].ownerDriverWorkspace,
        status: 'draft',
        token_hash: tokenHash,
        token_expires_at: tokenExpiresAt,
        token_last_sent_at: now,
        last_activity_at: now,
        current_step: 'account_type_confirmed',
        completion_percentage: 5,
        payload: {},
      })
      .select(APPLICATION_SELECT)
      .single();

    if (!error && data) {
      saved = data as ApplicationSummary;
      created = true;
      tokenWasRotated = true;
    } else if (error?.code === '23505') {
      // The register page and AuthProvider can legitimately initialize at the
      // same time. The losing request reads the committed row and succeeds.
      const raced = await getApplicationForUser(authUser.id);
      if (raced.error) return json(500, { error: raced.error.message });
      if (!raced.data) return json(409, { error: 'Concurrent onboarding initialization did not produce an application.' });
      saved = raced.data as ApplicationSummary;
      const typeError = validateExistingType(saved, storedType);
      if (typeError) return json(409, { error: typeError });
    } else {
      return json(500, { error: error?.message ?? 'Unable to initialize onboarding.' });
    }
  }

  const profileError = await ensurePendingProfile(authUser.id, requestedType, now);
  if (profileError) return json(500, { error: profileError });

  const onboardingUrl = tokenWasRotated ? buildOnboardingUrl(onboardingToken, storedType) : undefined;
  if ((created || parsed.data.forceRegenerateToken === true) && onboardingUrl) {
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
  return json(200, { ...payload, idempotent: !created && !tokenWasRotated });
}
