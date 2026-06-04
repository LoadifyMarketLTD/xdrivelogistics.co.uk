import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import { getResetPasswordEmailRedirectTo } from '../../../../lib/authFlow';

const ADMIN_ROLES = new Set(['owner', 'admin']);

type DispatcherOnboardingOutcome = 'invite_sent' | 'password_setup_required' | 'temporary_password_created';

type SendDispatcherPasswordSetupPayload = {
  companyId?: string;
  membershipId?: string | null;
  email?: string;
};

const createDispatcherPayloadSchema = z.object({
  displayName: z.string().trim().min(1),
  email: z.string().trim().min(1).transform((value) => value.toLowerCase()),
  phone: z.string().optional(),
});

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

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const findAuthUserIdByEmail = async (email: string) => {
  if (!supabaseAdmin) return null;

  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (listError || !listData) return null;

    const match = listData.users.find((user: { id: string; email?: string }) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (listData.users.length < perPage) return null;

    page += 1;
  }
};

const resolveAdminMembership = async (
  authUserId: string
) => {
  if (!supabaseAdmin) return { data: null, error: new Error('Server auth is not configured.') };

  return supabaseAdmin
    .from('company_memberships')
    .select('id, company_id, role_in_company')
    .eq('user_id', authUserId)
    .eq('status', 'active')
    .in('role_in_company', Array.from(ADMIN_ROLES))
    .maybeSingle();
};

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return respond(503, { error: 'Server auth is not configured.' });
    }

    const token = getBearerToken(request);
    if (!token) {
      return respond(401, { error: 'Unauthorized: missing bearer token.' });
    }

    const validatorClient = supabaseValidator ?? supabaseAdmin;
    const { data: authData, error: authError } = await validatorClient.auth.getUser(token);

    if (authError || !authData.user) {
      return respond(401, { error: 'Unauthorized: invalid or expired token.' });
    }

    const { data: membership, error: membershipError } = await resolveAdminMembership(authData.user.id);

    if (membershipError) {
      return respond(500, { error: membershipError.message });
    }

    if (!membership?.id || !membership.company_id) {
      return respond(403, { error: 'Forbidden' });
    }

    let parsedPayload: z.infer<typeof createDispatcherPayloadSchema>;
    try {
      parsedPayload = createDispatcherPayloadSchema.parse(await request.json());
    } catch (error) {
      if (error instanceof z.ZodError) {
        return respond(400, {
          error: 'displayName and email are required.',
        });
      }
      throw error;
    }

    const displayName = parsedPayload.displayName;
    const email = parsedPayload.email;
    const phone = parsedPayload.phone?.trim() || null;

    const resolvedCompanyId = membership.company_id;

    let userId: string | null = null;
    let invited = true;
    let temporaryPassword: string | null = null;
    let inviteFallbackReason: string | null = null;
    let onboardingOutcome: DispatcherOnboardingOutcome = 'invite_sent';

    const { data: invitedUserData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${getResetPasswordEmailRedirectTo()}?type=invite`,
      data: {
        role: 'company_staff',
        requested_role: 'dispatcher',
      },
    });

    if (!inviteError && invitedUserData.user) {
      userId = invitedUserData.user.id;
    } else if (inviteError) {
      const lowerMsg = (inviteError.message ?? '').toLowerCase();
      const isAlreadyExists =
        lowerMsg.includes('already registered') ||
        lowerMsg.includes('already been registered') ||
        lowerMsg.includes('user already exists') ||
        (inviteError as { code?: string }).code === 'email_exists';

      if (isAlreadyExists) {
        userId = await findAuthUserIdByEmail(email);
        invited = false;
        onboardingOutcome = 'password_setup_required';
      } else {
        invited = false;
        onboardingOutcome = 'temporary_password_created';
        inviteFallbackReason = `Invite email failed (${inviteError.message ?? 'unknown error'}). Dispatcher created with temporary password.`;
        temporaryPassword = generateStrongTemporaryPassword();

        const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            role: 'company_staff',
            requested_role: 'dispatcher',
          },
          app_metadata: {
            role: 'company_staff',
          },
        });

        if (createUserError || !createdUserData.user) {
          return respond(400, {
            error: `Failed to create dispatcher account. Invite email also failed: ${inviteError.message || 'unknown'}. Creation error: ${createUserError?.message || 'Failed to create dispatcher auth user.'}`,
          });
        }

        userId = createdUserData.user.id;
      }
    }

    if (!userId) {
      return respond(500, { error: 'Failed to resolve dispatcher auth user.' });
    }

    const { error: updateUserMetadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        role: 'company_staff',
        requested_role: 'dispatcher',
      },
      app_metadata: {
        role: 'company_staff',
      },
    });

    if (updateUserMetadataError) {
      return respond(400, { error: updateUserMetadataError.message });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          full_name: displayName,
          phone,
          role: 'company_staff',
          status: 'active',
          company_id: resolvedCompanyId,
          is_driver: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (profileError) {
      return respond(500, { error: `Failed to initialize dispatcher profile: ${profileError.message}` });
    }

    const { data: dispatcherMembership, error: dispatcherMembershipError } = await supabaseAdmin
      .from('company_memberships')
      .upsert(
        {
          company_id: resolvedCompanyId,
          user_id: userId,
          invited_email: email,
          role_in_company: 'dispatcher',
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,user_id' }
      )
      .select('id, company_id, user_id, invited_email, role_in_company, status, created_at')
      .maybeSingle();

    if (dispatcherMembershipError) {
      return respond(500, { error: `Failed to create dispatcher membership: ${dispatcherMembershipError.message}` });
    }

    return respond(201, {
      dispatcher: dispatcherMembership,
      invited,
      onboardingOutcome,
      temporaryPassword,
      inviteFallbackReason,
    });
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : 'Unexpected dispatcher onboarding failure.' });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return respond(503, { error: 'Server auth is not configured.' });
    }

    const token = getBearerToken(request);
    if (!token) {
      return respond(401, { error: 'Unauthorized: missing bearer token.' });
    }

    const validatorClient = supabaseValidator ?? supabaseAdmin;
    const { data: authData, error: authError } = await validatorClient.auth.getUser(token);

    if (authError || !authData.user) {
      return respond(401, { error: 'Unauthorized: invalid or expired token.' });
    }

    const payload = (await request.json()) as SendDispatcherPasswordSetupPayload;
    const email = payload.email?.trim().toLowerCase();

    const { data: membership, error: membershipError } = await resolveAdminMembership(authData.user.id);

    if (membershipError) {
      return respond(500, { error: membershipError.message });
    }

    if (!membership?.id || !membership.company_id) {
      return respond(403, { error: 'Forbidden' });
    }

    const resolvedCompanyId = membership.company_id;

    if (!email) {
      return respond(400, { error: 'email is required.' });
    }

    const { data: dispatcherMembership, error: dispatcherMembershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('company_id', resolvedCompanyId)
      .eq('role_in_company', 'dispatcher')
      .eq('invited_email', email)
      .limit(1)
      .maybeSingle();

    if (dispatcherMembershipError) {
      return respond(500, { error: `Failed to load dispatcher account: ${dispatcherMembershipError.message}` });
    }

    if (!dispatcherMembership?.id) {
      return respond(404, { error: 'Dispatcher account not found for this company.' });
    }

    const { error: passwordSetupError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: getResetPasswordEmailRedirectTo(),
    });

    if (passwordSetupError) {
      return respond(400, { error: passwordSetupError.message });
    }

    return respond(200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return respond(500, { error: message });
  }
}
