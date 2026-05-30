import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { getResetPasswordEmailRedirectTo } from '../../../../lib/authFlow';
import { logRuntimeProof } from '../../../../lib/runtimeProof';

// Canonical roles + legacy aliases used in company_memberships.role_in_company
const ADMIN_ROLES = new Set(['owner', 'admin', 'dispatcher', 'company_admin', 'admin_staff', 'company']);

type CreateDriverPayload = {
  companyId?: string;
  membershipId?: string | null;
  displayName?: string;
  email?: string;
  phone?: string;
};

type ForensicLogLevel = 'info' | 'warn' | 'error';

type ForensicErrorPayload = {
  name: string | null;
  message: string | null;
  code: string | null;
  status: number | string | null;
  details: string | null;
  hint: string | null;
  stack: string | null;
};

const FORENSIC_SQL = {
  membershipLookup:
    "select id, company_id, role_in_company from public.company_memberships where user_id = :auth_user_id and status = 'active' and company_id = :company_id and role_in_company in (:admin_roles) and (:membership_id is null or id = :membership_id) limit 1",
  companyLookup:
    'select id, name from public.companies where id = :company_id limit 1',
  existingDriverLookup:
    'select id, user_id, company_id from public.drivers where email = :email limit 1',
  profileUpsert:
    'insert into public.profiles (user_id, full_name, phone, role, status, company_id, is_driver, updated_at) values (:user_id, :full_name, :phone, :role, :status, :company_id, :is_driver, :updated_at) on conflict (user_id) do update set full_name = excluded.full_name, phone = excluded.phone, role = excluded.role, status = excluded.status, company_id = excluded.company_id, is_driver = excluded.is_driver, updated_at = excluded.updated_at',
  driversInsert:
    'insert into public.drivers (company_id, user_id, display_name, phone, email, status, app_access, must_change_password, temp_password_generated_at) values (:company_id, :user_id, :display_name, :phone, :email, :status, :app_access, :must_change_password, :temp_password_generated_at) returning id, company_id, user_id, display_name, phone, email, status, app_access, temporary_password_seq, must_change_password, created_at',
  driversUpdate:
    'update public.drivers set company_id = :company_id, user_id = :user_id, display_name = :display_name, phone = :phone, email = :email, status = :status, app_access = :app_access, updated_at = :updated_at where id = :driver_id returning id, company_id, user_id, display_name, phone, email, status, app_access, temporary_password_seq, must_change_password, created_at',
  companyMembershipsUpsert:
    "insert into public.company_memberships (company_id, user_id, invited_email, role_in_company, status, updated_at) values (:company_id, :user_id, :invited_email, :role_in_company, :status, :updated_at) on conflict (company_id, user_id) do update set invited_email = excluded.invited_email, role_in_company = excluded.role_in_company, status = excluded.status, updated_at = excluded.updated_at",
} as const;

const getRequestId = (request: NextRequest) =>
  request.headers.get('x-nf-request-id')?.trim() ||
  request.headers.get('x-request-id')?.trim() ||
  crypto.randomUUID();

const sanitizeResponsePayload = (payload: Record<string, unknown>) => {
  if (!('temporaryPassword' in payload)) return payload;
  return {
    ...payload,
    temporaryPassword: payload.temporaryPassword ? '[redacted]' : payload.temporaryPassword,
  };
};

const toForensicErrorPayload = (error: unknown): ForensicErrorPayload => {
  if (!error) {
    return {
      name: null,
      message: null,
      code: null,
      status: null,
      details: null,
      hint: null,
      stack: null,
    };
  }

  if (error instanceof Error) {
    const enrichedError = error as Error & {
      code?: string | number | null;
      status?: string | number | null;
      details?: string | null;
      hint?: string | null;
    };

    return {
      name: enrichedError.name ?? 'Error',
      message: enrichedError.message ?? null,
      code: enrichedError.code != null ? String(enrichedError.code) : null,
      status: enrichedError.status ?? null,
      details: enrichedError.details ?? null,
      hint: enrichedError.hint ?? null,
      stack: enrichedError.stack ?? null,
    };
  }

  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : null,
      message: typeof record.message === 'string' ? record.message : JSON.stringify(record),
      code: typeof record.code === 'string' || typeof record.code === 'number' ? String(record.code) : null,
      status:
        typeof record.status === 'string' || typeof record.status === 'number' ? record.status : null,
      details: typeof record.details === 'string' ? record.details : null,
      hint: typeof record.hint === 'string' ? record.hint : null,
      stack: typeof record.stack === 'string' ? record.stack : null,
    };
  }

  return {
    name: null,
    message: String(error),
    code: null,
    status: null,
    details: null,
    hint: null,
    stack: null,
  };
};

const logForensicEvent = (
  level: ForensicLogLevel,
  requestId: string,
  step: string,
  phase: 'start' | 'success' | 'error' | 'skip',
  details: Record<string, unknown>
) => {
  const method = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  method(`[admin/drivers][forensic][${requestId}] ${step} ${phase}`, details);
};

const logForensicStart = (
  requestId: string,
  step: string,
  operation: string,
  details: Record<string, unknown> = {}
) => {
  const callSiteStack = new Error(`[admin/drivers] ${step}`).stack ?? null;
  logForensicEvent('info', requestId, step, 'start', {
    operation,
    callSiteStack,
    ...details,
  });
  return callSiteStack;
};

const logForensicSuccess = (
  requestId: string,
  step: string,
  operation: string,
  details: Record<string, unknown> = {}
) => {
  logForensicEvent('info', requestId, step, 'success', {
    operation,
    ...details,
  });
};

const logForensicFailure = (
  requestId: string,
  step: string,
  operation: string,
  error: unknown,
  details: {
    sqlStatement?: string | null;
    callSiteStack?: string | null;
    level?: ForensicLogLevel;
  } & Record<string, unknown> = {}
) => {
  const { level = 'error', ...rest } = details;
  logForensicEvent(level, requestId, step, 'error', {
    operation,
    sqlStatement: details.sqlStatement ?? null,
    callSiteStack: details.callSiteStack ?? null,
    error: toForensicErrorPayload(error),
    ...rest,
  });
};

const logForensicSkip = (
  requestId: string,
  step: string,
  operation: string,
  details: Record<string, unknown> = {}
) => {
  logForensicEvent('info', requestId, step, 'skip', {
    operation,
    ...details,
  });
};

const TEMP_PASSWORD_CHARSETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+',
};

const getRandomInt = (maxExclusive: number) => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % maxExclusive;
};

const shuffle = (chars: string[]) => {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
};

const generateStrongTemporaryPassword = (length = 20) => {
  const all =
    TEMP_PASSWORD_CHARSETS.upper +
    TEMP_PASSWORD_CHARSETS.lower +
    TEMP_PASSWORD_CHARSETS.digits +
    TEMP_PASSWORD_CHARSETS.symbols;

  const chars = [
    TEMP_PASSWORD_CHARSETS.upper[getRandomInt(TEMP_PASSWORD_CHARSETS.upper.length)],
    TEMP_PASSWORD_CHARSETS.lower[getRandomInt(TEMP_PASSWORD_CHARSETS.lower.length)],
    TEMP_PASSWORD_CHARSETS.digits[getRandomInt(TEMP_PASSWORD_CHARSETS.digits.length)],
    TEMP_PASSWORD_CHARSETS.symbols[getRandomInt(TEMP_PASSWORD_CHARSETS.symbols.length)],
  ];

  while (chars.length < length) {
    chars.push(all[getRandomInt(all.length)]);
  }

  return shuffle(chars).join('');
};

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const respond = (status: number, payload: Record<string, unknown>, reason: string) => {
    logForensicEvent('info', requestId, 'final response', 'success', {
      reason,
      status,
      response: sanitizeResponsePayload(payload),
    });

    const response = NextResponse.json(payload, { status });
    response.headers.set('x-request-id', requestId);
    return response;
  };

  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return respond(503, { error: 'Server auth is not configured.' }, 'supabase_admin_unconfigured');
    }

    const requestValidationStack = logForensicStart(
      requestId,
      'request validation',
      'validate bearer token and request payload'
    );

    const token = getBearerToken(request);
    if (!token) {
      logForensicFailure(
        requestId,
        'request validation',
        'validate bearer token and request payload',
        new Error('Unauthorized: missing bearer token.'),
        {
          callSiteStack: requestValidationStack,
        }
      );

      return respond(
        401,
        {
          error: 'Unauthorized: missing bearer token.',
          code: 'auth_missing_bearer_token',
        },
        'auth_missing_bearer_token'
      );
    }

    // Use the anon-key validator so JWT verification never depends on the
    // service-role key being correct in non-production environments.
    const validatorClient = supabaseValidator ?? supabaseAdmin;
    if (!validatorClient) {
      logForensicFailure(
        requestId,
        'request validation',
        'validate bearer token and request payload',
        new Error('Server auth is not configured.'),
        {
          callSiteStack: requestValidationStack,
        }
      );
      return respond(503, { error: 'Server auth is not configured.' }, 'validator_client_missing');
    }

    const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
    if (authError || !authData.user) {
      console.error('[admin/drivers] auth token validation failed', {
        error: authError?.message ?? null,
        code: authError?.code ?? null,
        status: authError?.status ?? null,
      });

      logForensicFailure(
        requestId,
        'request validation',
        'validate bearer token and request payload',
        authError ?? new Error('Unauthorized: invalid or expired token.'),
        {
          callSiteStack: requestValidationStack,
        }
      );

      return respond(
        401,
        {
          error: 'Unauthorized: invalid or expired token.',
          code: 'auth_invalid_bearer_token',
        },
        'auth_invalid_bearer_token'
      );
    }

    const payload = (await request.json()) as CreateDriverPayload;
    const requestedCompanyId = payload.companyId?.trim();
    const requestedMembershipId = payload.membershipId?.trim();
    const displayName = payload.displayName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const phone = payload.phone?.trim() || null;

    if (!displayName || !email) {
      logForensicFailure(
        requestId,
        'request validation',
        'validate bearer token and request payload',
        new Error('displayName and email are required.'),
        {
          callSiteStack: requestValidationStack,
        }
      );
      return respond(400, { error: 'displayName and email are required.' }, 'missing_required_fields');
    }

    if (!requestedCompanyId) {
      logForensicFailure(
        requestId,
        'request validation',
        'validate bearer token and request payload',
        new Error('Forbidden: missing company or membership context.'),
        {
          callSiteStack: requestValidationStack,
        }
      );
      return respond(
        403,
        {
          error: 'Forbidden: missing company or membership context.',
          code: 'auth_missing_membership_context',
        },
        'auth_missing_membership_context'
      );
    }

    logForensicSuccess(requestId, 'request validation', 'validate bearer token and request payload', {
      authUserId: authData.user.id,
      requestedCompanyId,
      requestedMembershipId: requestedMembershipId ?? null,
      email,
    });

    let resolvedMembership: { id: string; company_id: string; role_in_company: string } | null = null;

    const membershipLookupStack = logForensicStart(
      requestId,
      'membership lookup',
      'lookup active admin membership',
      {
        sqlStatement: FORENSIC_SQL.membershipLookup,
        requestedMembershipId,
        requestedCompanyId,
        membershipIdFilterApplied: Boolean(requestedMembershipId),
      }
    );

    let membershipQuery = supabaseAdmin
      .from('company_memberships')
      .select('id, company_id, role_in_company')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .eq('company_id', requestedCompanyId)
      .in('role_in_company', Array.from(ADMIN_ROLES));

    if (requestedMembershipId) {
      membershipQuery = membershipQuery.eq('id', requestedMembershipId);
    }

    const { data: membership, error: membershipLookupError } = await membershipQuery.maybeSingle();

    if (membershipLookupError) {
      logForensicFailure(
        requestId,
        'membership lookup',
        'lookup active admin membership',
        membershipLookupError,
        {
        callSiteStack: membershipLookupStack,
        sqlStatement: FORENSIC_SQL.membershipLookup,
        authUserId: authData.user.id,
        membershipIdFilterApplied: Boolean(requestedMembershipId),
        }
      );
      return respond(500, { error: membershipLookupError.message }, 'membership_lookup_failed');
    }

    resolvedMembership = membership ?? null;
    logForensicSuccess(requestId, 'membership lookup', 'lookup active admin membership', {
      membershipId: resolvedMembership?.id ?? null,
      companyId: resolvedMembership?.company_id ?? null,
      roleInCompany: resolvedMembership?.role_in_company ?? null,
      membershipIdFilterApplied: Boolean(requestedMembershipId),
    });

    if (!resolvedMembership?.id || !resolvedMembership.company_id) {
      logForensicFailure(
        requestId,
        'membership lookup',
        'lookup active admin membership',
        new Error('Forbidden'),
        {
          membershipId: resolvedMembership?.id ?? null,
          companyId: resolvedMembership?.company_id ?? null,
        }
      );
      return respond(403, { error: 'Forbidden' }, 'membership_not_resolved');
    }

    const resolvedCompanyId = resolvedMembership.company_id;

    const companyLookupStack = logForensicStart(
      requestId,
      'company lookup',
      'lookup company by resolved membership company_id',
      {
        sqlStatement: FORENSIC_SQL.companyLookup,
        companyId: resolvedCompanyId,
      }
    );
    const { data: companyLookup, error: companyLookupError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('id', resolvedCompanyId)
      .limit(1)
      .maybeSingle();

    if (companyLookupError) {
      logForensicFailure(
        requestId,
        'company lookup',
        'lookup company by resolved membership company_id',
        companyLookupError,
        {
          level: 'warn',
          callSiteStack: companyLookupStack,
          sqlStatement: FORENSIC_SQL.companyLookup,
          companyId: resolvedCompanyId,
        }
      );
    } else {
      logForensicSuccess(requestId, 'company lookup', 'lookup company by resolved membership company_id', {
        companyFound: Boolean(companyLookup?.id),
        companyId: companyLookup?.id ?? resolvedCompanyId,
        companyName: companyLookup?.name ?? null,
      });
    }

    logRuntimeProof({
      flow: 'Add Driver',
      authUid: authData.user.id,
      membershipId: resolvedMembership.id,
      companyId: resolvedCompanyId,
      payload: {
        company_id: resolvedCompanyId,
        display_name: displayName,
        email,
        phone,
        role_in_company: resolvedMembership.role_in_company,
      },
      table: 'drivers',
      rlsPolicy: 'drivers_insert_operator',
    });

    const existingDriverLookupStack = logForensicStart(
      requestId,
      'existing driver lookup',
      'lookup driver by email before invite flow',
      {
        sqlStatement: FORENSIC_SQL.existingDriverLookup,
        email,
      }
    );

    // ── Step 1: detect partial existing state ────────────────────────────────
    // Look up by email in the drivers table first.  This covers the case where
    // auth user + driver row already exist but company_memberships is missing.
    const { data: existingDriverByEmail, error: existingDriverLookupError } = await supabaseAdmin
      .from('drivers')
      .select('id, user_id, company_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (existingDriverLookupError) {
      logForensicFailure(
        requestId,
        'existing driver lookup',
        'lookup driver by email before invite flow',
        existingDriverLookupError,
        {
          callSiteStack: existingDriverLookupStack,
          sqlStatement: FORENSIC_SQL.existingDriverLookup,
          email,
        }
      );
      return respond(
        500,
        { error: `Failed to inspect existing driver records: ${existingDriverLookupError.message}` },
        'existing_driver_lookup_failed'
      );
    }

    logForensicSuccess(requestId, 'existing driver lookup', 'lookup driver by email before invite flow', {
      existingDriverId: existingDriverByEmail?.id ?? null,
      existingDriverUserId: existingDriverByEmail?.user_id ?? null,
      existingDriverCompanyId: existingDriverByEmail?.company_id ?? null,
    });

    let userId: string | null = existingDriverByEmail?.user_id ?? null;
    const existingDriverId: string | null = existingDriverByEmail?.id ?? null;
    let invited = true;
    let temporaryPassword: string | null = null;
    let inviteFallbackReason: string | null = null;

    // ── Step 2: resolve / create auth user ───────────────────────────────────
    if (!userId) {
      const inviteUserStack = logForensicStart(
        requestId,
        'inviteUserByEmail()',
        'invite auth user by email',
        {
          email,
        }
      );
      const { data: invitedUserData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${getResetPasswordEmailRedirectTo()}?type=invite`,
        data: {
          role: 'driver',
          requested_role: 'driver',
        },
      });

      if (!inviteError && invitedUserData.user) {
        userId = invitedUserData.user.id;
        logForensicSuccess(requestId, 'inviteUserByEmail()', 'invite auth user by email', {
          invitedUserId: userId,
          invitedUserEmail: invitedUserData.user.email ?? email,
        });
      } else if (inviteError) {
        logForensicFailure(requestId, 'inviteUserByEmail()', 'invite auth user by email', inviteError, {
          level: 'warn',
          callSiteStack: inviteUserStack,
          email,
        });

        // User already registered in auth but has no driver row yet — look up via
        // the auth admin list (small page; exact email match).
        const lowerMsg = (inviteError.message ?? '').toLowerCase();
        const isAlreadyExists =
          lowerMsg.includes('already registered') ||
          lowerMsg.includes('already been registered') ||
          lowerMsg.includes('user already exists') ||
          (inviteError as { code?: string }).code === 'email_exists';

        if (isAlreadyExists) {
          // Page through users to find the matching auth record.
          let found: string | null = null;
          let page = 1;
          const perPage = 1000;
          while (!found) {
            const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
              page,
              perPage,
            });
            if (listError || !listData) break;
            const match = listData.users.find((u: { id: string; email?: string }) => u.email?.toLowerCase() === email);
            if (match) {
              found = match.id;
            } else if (listData.users.length < perPage) {
              break;
            } else {
              page += 1;
            }
          }
          userId = found;
          invited = false;
          logForensicSuccess(requestId, 'inviteUserByEmail()', 'resolve already-existing auth user after invite failure', {
            resolvedExistingAuthUserId: userId,
          });
          logForensicSkip(requestId, 'createUser() fallback path', 'create auth user with temporary password fallback', {
            reason: 'invite failure mapped to existing auth user; fallback not needed',
          });
        } else {
          // Email invite failed for any reason (SMTP misconfiguration, invalid API key,
          // rate limit, etc.) — fall back to password-based creation so the driver can
          // still be onboarded. The admin can send a password-reset email afterwards.
          invited = false;
          inviteFallbackReason = `Invite email failed (${inviteError.message ?? 'unknown error'}). Driver created with temporary password.`;

          const createUserFallbackStack = logForensicStart(
            requestId,
            'createUser() fallback path',
            'create auth user with temporary password fallback',
            {
              email,
              inviteFallbackReason,
            }
          );
          temporaryPassword = generateStrongTemporaryPassword();
          const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: {
              role: 'driver',
              requested_role: 'driver',
            },
            app_metadata: {
              role: 'driver',
            },
          });

          if (createUserError || !createdUserData.user) {
            logForensicFailure(
              requestId,
              'createUser() fallback path',
              'create auth user with temporary password fallback',
              createUserError ?? new Error('Failed to create driver auth user.'),
              {
                callSiteStack: createUserFallbackStack,
                email,
              }
            );
            return respond(
              400,
              {
                error: `Failed to create driver account. Invite email also failed: ${inviteError.message || 'unknown'}. Creation error: ${createUserError?.message || 'Failed to create driver auth user.'}`,
              },
              'create_user_fallback_failed'
            );
          }

          userId = createdUserData.user.id;
          logForensicSuccess(
            requestId,
            'createUser() fallback path',
            'create auth user with temporary password fallback',
            {
              createdUserId: userId,
              createdUserEmail: createdUserData.user.email ?? email,
              inviteFallbackReason,
            }
          );
        }
      }
    } else {
      logForensicSkip(requestId, 'inviteUserByEmail()', 'invite auth user by email', {
        reason: 'existing driver already linked to auth user',
        userId,
      });
      logForensicSkip(requestId, 'createUser() fallback path', 'create auth user with temporary password fallback', {
        reason: 'existing driver already linked to auth user',
        userId,
      });
    }

    if (!userId) {
      logForensicFailure(
        requestId,
        'inviteUserByEmail()',
        'resolve or create auth user',
        new Error('Failed to resolve driver auth user.')
      );
      return respond(500, { error: 'Failed to resolve driver auth user.' }, 'auth_user_resolution_failed');
    }

    const updateUserMetadataStack = logForensicStart(
      requestId,
      'user metadata update',
      'update auth user metadata for driver role',
      {
        userId,
      }
    );

    // ── Step 3: ensure auth metadata is correct ───────────────────────────────
    const { error: updateUserMetadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: 'driver',
        requested_role: 'driver',
      },
    });

    if (updateUserMetadataError) {
      logForensicFailure(
        requestId,
        'user metadata update',
        'update auth user metadata for driver role',
        updateUserMetadataError,
        {
          callSiteStack: updateUserMetadataStack,
          userId,
        }
      );
      return respond(400, { error: updateUserMetadataError.message }, 'user_metadata_update_failed');
    }

    logForensicSuccess(requestId, 'user metadata update', 'update auth user metadata for driver role', {
      userId,
    });

    const profileUpsertStack = logForensicStart(
      requestId,
      'profiles upsert',
      'upsert driver profile row',
      {
        sqlStatement: FORENSIC_SQL.profileUpsert,
        userId,
        companyId: resolvedCompanyId,
      }
    );

    // ── Step 4: upsert profile ────────────────────────────────────────────────
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          full_name: displayName,
          phone,
          role: 'driver',
          status: 'active',
          company_id: resolvedCompanyId,
          is_driver: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (profileError) {
      logForensicFailure(requestId, 'profiles upsert', 'upsert driver profile row', profileError, {
        callSiteStack: profileUpsertStack,
        sqlStatement: FORENSIC_SQL.profileUpsert,
        userId,
        companyId: resolvedCompanyId,
      });
      return respond(
        500,
        { error: `Failed to initialize driver profile: ${profileError.message}` },
        'profile_upsert_failed'
      );
    }

    logForensicSuccess(requestId, 'profiles upsert', 'upsert driver profile row', {
      userId,
      companyId: resolvedCompanyId,
      role: 'driver',
      status: 'active',
    });

    // ── Step 5: upsert driver row (idempotent) ────────────────────────────────
    // If a driver row already exists (by id), update it in-place; otherwise insert.
    let driverRow: Record<string, unknown> | null = null;

    if (existingDriverId) {
      const driverWriteStack = logForensicStart(
        requestId,
        'drivers insert',
        'update existing driver row',
        {
          sqlStatement: FORENSIC_SQL.driversUpdate,
          driverId: existingDriverId,
          companyId: resolvedCompanyId,
          userId,
        }
      );
      const { data: updatedDriver, error: updateError } = await supabaseAdmin
        .from('drivers')
        .update({
          company_id: resolvedCompanyId,
          user_id: userId,
          display_name: displayName,
          phone,
          email,
          status: 'active',
          app_access: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDriverId)
        .select('id, company_id, user_id, display_name, phone, email, status, app_access, temporary_password_seq, must_change_password, created_at')
        .single();

      if (updateError) {
        logForensicFailure(requestId, 'drivers insert', 'update existing driver row', updateError, {
          callSiteStack: driverWriteStack,
          sqlStatement: FORENSIC_SQL.driversUpdate,
          driverId: existingDriverId,
        });
        return respond(500, { error: `Failed to update driver record: ${updateError.message}` }, 'driver_update_failed');
      }
      driverRow = updatedDriver;
      logForensicSuccess(requestId, 'drivers insert', 'update existing driver row', {
        driverId: (driverRow?.id as string | undefined) ?? existingDriverId,
        mode: 'update',
      });
    } else {
      const driverWriteStack = logForensicStart(
        requestId,
        'drivers insert',
        'insert new driver row',
        {
          sqlStatement: FORENSIC_SQL.driversInsert,
          companyId: resolvedCompanyId,
          userId,
        }
      );
      const { data: insertedDriver, error: driverInsertError } = await supabaseAdmin
        .from('drivers')
        .insert([
          {
            company_id: resolvedCompanyId,
            user_id: userId,
            display_name: displayName,
            phone,
            email,
            status: 'active',
            app_access: true,
            must_change_password: !invited,
            temp_password_generated_at: invited ? null : new Date().toISOString(),
          },
        ])
        .select('id, company_id, user_id, display_name, phone, email, status, app_access, temporary_password_seq, must_change_password, created_at')
        .single();

      if (driverInsertError) {
        logForensicFailure(requestId, 'drivers insert', 'insert new driver row', driverInsertError, {
          callSiteStack: driverWriteStack,
          sqlStatement: FORENSIC_SQL.driversInsert,
          companyId: resolvedCompanyId,
          userId,
        });
        return respond(
          500,
          { error: `Failed to create driver record: ${driverInsertError.message}` },
          'driver_insert_failed'
        );
      }
      driverRow = insertedDriver;
      logForensicSuccess(requestId, 'drivers insert', 'insert new driver row', {
        driverId: (driverRow?.id as string | undefined) ?? null,
        mode: 'insert',
      });
    }

    const membershipsUpsertStack = logForensicStart(
      requestId,
      'company_memberships upsert',
      'upsert driver membership row',
      {
        sqlStatement: FORENSIC_SQL.companyMembershipsUpsert,
        companyId: resolvedCompanyId,
        userId,
      }
    );

    // ── Step 6: upsert company_memberships (idempotent) ──────────────────────
    // Drivers get role_in_company = 'viewer' (the lowest valid enum value).
    // On conflict (company_id, user_id) we update status to active so a
    // previously-suspended membership is re-activated.
    const { error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .upsert(
        {
          company_id: resolvedCompanyId,
          user_id: userId,
          invited_email: email,
          role_in_company: 'viewer',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,user_id' }
      );

    if (membershipError) {
      // Non-fatal: log the error but don't block the response — the driver row
      // is already created/updated and the admin can re-run to repair.
      console.error('[admin/drivers] company_memberships upsert failed', membershipError.message);
      logForensicFailure(
        requestId,
        'company_memberships upsert',
        'upsert driver membership row',
        membershipError,
        {
          level: 'warn',
          callSiteStack: membershipsUpsertStack,
          sqlStatement: FORENSIC_SQL.companyMembershipsUpsert,
          companyId: resolvedCompanyId,
          userId,
        }
      );
    } else {
      logForensicSuccess(requestId, 'company_memberships upsert', 'upsert driver membership row', {
        companyId: resolvedCompanyId,
        userId,
        roleInCompany: 'viewer',
        status: 'active',
      });
    }

    return respond(
      existingDriverId ? 200 : 201,
      {
        driver: driverRow,
        invited,
        temporaryPassword,
        inviteFallbackReason,
        membershipRepaired: !membershipError,
      },
      existingDriverId ? 'existing_driver_updated' : 'driver_created'
    );
  } catch (error) {
    logForensicFailure(requestId, 'unhandled exception', 'unexpected POST /api/admin/drivers failure', error, {
      callSiteStack: new Error('[admin/drivers] unhandled exception').stack ?? null,
    });
    return respond(
      500,
      {
        error: 'Unexpected server error while creating driver.',
      },
      'unexpected_exception'
    );
  }
}
