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

const isInvalidApiKeyError = (message?: string | null, code?: string | null) => {
  const value = `${message ?? ''} ${code ?? ''}`.toLowerCase();
  return value.includes('invalid api key');
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
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      {
        error: 'Unauthorized: missing bearer token.',
        code: 'auth_missing_bearer_token',
      },
      { status: 401 }
    );
  }

  // Use the anon-key validator so JWT verification never depends on the
  // service-role key being correct in non-production environments.
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  if (!validatorClient) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    console.error('[admin/drivers] auth token validation failed', {
      error: authError?.message ?? null,
      code: authError?.code ?? null,
      status: authError?.status ?? null,
    });
    return NextResponse.json(
      {
        error: 'Unauthorized: invalid or expired token.',
        code: 'auth_invalid_bearer_token',
      },
      { status: 401 }
    );
  }

  const payload = (await request.json()) as CreateDriverPayload;
  const requestedCompanyId = payload.companyId?.trim();
  const requestedMembershipId = payload.membershipId?.trim();
  const displayName = payload.displayName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const phone = payload.phone?.trim() || null;

  if (!displayName || !email) {
    return NextResponse.json({ error: 'displayName and email are required.' }, { status: 400 });
  }

  if (!requestedCompanyId) {
    return NextResponse.json(
      {
        error: 'Forbidden: missing company or membership context.',
        code: 'auth_missing_membership_context',
      },
      { status: 403 }
    );
  }

  let resolvedMembership: { id: string; company_id: string; role_in_company: string } | null = null;

  if (requestedMembershipId) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('id, company_id, role_in_company')
      .eq('user_id', authData.user.id)
      .eq('status', 'active')
      .eq('id', requestedMembershipId)
      .eq('company_id', requestedCompanyId)
      .in('role_in_company', Array.from(ADMIN_ROLES))
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }
    resolvedMembership = membership ?? null;
  }

  // Profile-based fallback: handles users who have a valid profile + company but
  // no company_memberships row (e.g. owner provisioned before the membership
  // bootstrap RPC existed, or if the membership query failed during auth).
  if (!resolvedMembership) {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('company_id, role')
      .eq('user_id', authData.user.id)
      .eq('company_id', requestedCompanyId)
      .maybeSingle();

    if (!profileError && profileData?.company_id && ADMIN_ROLES.has(profileData.role ?? '')) {
      resolvedMembership = {
        id: authData.user.id,
        company_id: profileData.company_id,
        role_in_company: profileData.role ?? 'admin',
      };
    }
  }

  if (!resolvedMembership?.id || !resolvedMembership.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const resolvedCompanyId = resolvedMembership.company_id;

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

  // ── Step 1: detect partial existing state ────────────────────────────────
  // Look up by email in the drivers table first.  This covers the case where
  // auth user + driver row already exist but company_memberships is missing.
  const { data: existingDriverByEmail } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, company_id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  let userId: string | null = existingDriverByEmail?.user_id ?? null;
  let existingDriverId: string | null = existingDriverByEmail?.id ?? null;
  let invited = true;
  let temporaryPassword: string | null = null;
  let inviteFallbackReason: string | null = null;

  // ── Step 2: resolve / create auth user ───────────────────────────────────
  if (!userId) {
    const { data: invitedUserData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${getResetPasswordEmailRedirectTo()}?type=invite`,
      data: {
        role: 'driver',
        requested_role: 'driver',
      },
    });

    if (!inviteError && invitedUserData.user) {
      userId = invitedUserData.user.id;
    } else if (isInvalidApiKeyError(inviteError?.message, inviteError?.code)) {
      // Email invite provider not configured — fall back to password-based creation.
      invited = false;
      inviteFallbackReason = 'Supabase Auth invite provider returned invalid API key.';
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
        return NextResponse.json(
          {
            error: `Invite email provider API key is invalid. Fallback user creation failed: ${createUserError?.message || 'Failed to create driver auth user.'}`,
          },
          { status: 400 }
        );
      }

      userId = createdUserData.user.id;
    } else if (inviteError) {
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
      } else {
        return NextResponse.json({ error: inviteError.message || 'Failed to invite driver auth user.' }, { status: 400 });
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ error: 'Failed to resolve driver auth user.' }, { status: 500 });
  }

  // ── Step 3: ensure auth metadata is correct ───────────────────────────────
  const { error: updateUserMetadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: 'driver',
      requested_role: 'driver',
    },
  });

  if (updateUserMetadataError) {
    return NextResponse.json({ error: updateUserMetadataError.message }, { status: 400 });
  }

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
    return NextResponse.json({ error: `Failed to initialize driver profile: ${profileError.message}` }, { status: 500 });
  }

  // ── Step 5: upsert driver row (idempotent) ────────────────────────────────
  // If a driver row already exists (by id), update it in-place; otherwise insert.
  let driverRow: Record<string, unknown> | null = null;

  if (existingDriverId) {
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
      return NextResponse.json({ error: `Failed to update driver record: ${updateError.message}` }, { status: 500 });
    }
    driverRow = updatedDriver;
  } else {
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
      return NextResponse.json({ error: `Failed to create driver record: ${driverInsertError.message}` }, { status: 500 });
    }
    driverRow = insertedDriver;
  }

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
  }

  return NextResponse.json(
    {
      driver: driverRow,
      invited,
      temporaryPassword,
      inviteFallbackReason,
      membershipRepaired: !membershipError,
    },
    { status: existingDriverId ? 200 : 201 }
  );
}
