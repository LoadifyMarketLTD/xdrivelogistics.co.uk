import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { getResetPasswordEmailRedirectTo } from '../../../../lib/authFlow';

const ADMIN_ROLES = new Set(['owner', 'admin', 'dispatcher']);

type CreateDriverPayload = {
  companyId?: string;
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

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
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
  const displayName = payload.displayName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const phone = payload.phone?.trim() || null;

  if (!displayName || !email) {
    return NextResponse.json({ error: 'displayName and email are required.' }, { status: 400 });
  }

  const { data: actorProfile, error: actorProfileError } = await supabaseAdmin
    .from('profiles')
    .select('company_id')
    .eq('user_id', authData.user.id)
    .limit(1)
    .maybeSingle();

  if (actorProfileError) {
    return NextResponse.json({ error: actorProfileError.message }, { status: 500 });
  }

  const authCompanyId =
    typeof actorProfile?.company_id === 'string' && actorProfile.company_id.length > 0
      ? actorProfile.company_id
      : null;

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', Array.from(ADMIN_ROLES));

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const allowedCompanyIds = (memberships ?? [])
    .map((membership) => membership.company_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const resolvedCompanyId =
    (authCompanyId && allowedCompanyIds.includes(authCompanyId) && authCompanyId) ||
    (requestedCompanyId && allowedCompanyIds.includes(requestedCompanyId) && requestedCompanyId) ||
    allowedCompanyIds[0] ||
    null;

  if (!resolvedCompanyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
