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

  const { data: invitedUserData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getResetPasswordEmailRedirectTo()}?type=invite`,
    data: {
      role: 'driver',
      requested_role: 'driver',
    },
  });

  if (inviteError || !invitedUserData.user) {
    return NextResponse.json({ error: inviteError?.message || 'Failed to invite driver auth user.' }, { status: 400 });
  }

  const userId = invitedUserData.user.id;

  const { error: updateUserMetadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      role: 'driver',
      requested_role: 'driver',
    },
  });

  if (updateUserMetadataError) {
    return NextResponse.json({ error: updateUserMetadataError.message }, { status: 400 });
  }

  const { data: existingDriver } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existingDriver?.id) {
    return NextResponse.json({ error: 'Driver account already exists for this email.' }, { status: 409 });
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        full_name: displayName,
        phone,
        role: 'driver',
        company_id: resolvedCompanyId,
        is_driver: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (profileError) {
    return NextResponse.json({ error: `Failed to initialize driver profile: ${profileError.message}` }, { status: 500 });
  }

  const { data: driverRow, error: driverInsertError } = await supabaseAdmin
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
        must_change_password: false,
        temp_password_generated_at: null,
      },
    ])
    .select('id, company_id, user_id, display_name, phone, email, status, app_access, temporary_password_seq, must_change_password, created_at')
    .single();

  if (driverInsertError) {
    return NextResponse.json({ error: `Failed to create driver record: ${driverInsertError.message}` }, { status: 500 });
  }

  return NextResponse.json(
    {
      driver: driverRow,
      invited: true,
    },
    { status: 201 }
  );
}
