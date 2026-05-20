import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

const ADMIN_ROLES = new Set(['owner', 'admin', 'dispatcher']);

type CreateDriverPayload = {
  companyId?: string;
  displayName?: string;
  email?: string;
  phone?: string;
};

const formatTempPassword = (sequenceNumber: number) => `Xdrive-${String(sequenceNumber).padStart(3, '0')}`;

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await request.json()) as CreateDriverPayload;
  const companyId = payload.companyId?.trim();
  const displayName = payload.displayName?.trim();
  const email = payload.email?.trim().toLowerCase();
  const phone = payload.phone?.trim() || null;

  if (!companyId || !displayName || !email) {
    return NextResponse.json({ error: 'companyId, displayName and email are required.' }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company')
    .eq('company_id', companyId)
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership || !ADMIN_ROLES.has(String(membership.role_in_company))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: sequenceData, error: sequenceError } = await supabaseAdmin.rpc('next_driver_temp_password_seq');
  if (sequenceError || typeof sequenceData !== 'number') {
    return NextResponse.json({ error: 'Failed to generate temporary password sequence.' }, { status: 500 });
  }

  const sequenceNumber = sequenceData;
  const temporaryPassword = formatTempPassword(sequenceNumber);

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      role: 'driver',
      requested_role: 'driver',
    },
  });

  if (createUserError || !createdUser.user) {
    return NextResponse.json({ error: createUserError?.message || 'Failed to create driver auth user.' }, { status: 400 });
  }

  const userId = createdUser.user.id;

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: displayName,
        phone,
        email,
        role: 'driver',
        company_id: companyId,
        is_driver: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: `Failed to initialize driver profile: ${profileError.message}` }, { status: 500 });
  }

  const { data: driverRow, error: driverInsertError } = await supabaseAdmin
    .from('drivers')
    .insert([
      {
        company_id: companyId,
        user_id: userId,
        display_name: displayName,
        phone,
        email,
        status: 'active',
        app_access: true,
        temporary_password_seq: sequenceNumber,
        must_change_password: true,
        temp_password_generated_at: new Date().toISOString(),
      },
    ])
    .select('id, company_id, user_id, display_name, phone, email, status, app_access, temporary_password_seq, must_change_password, created_at')
    .single();

  if (driverInsertError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: `Failed to create driver record: ${driverInsertError.message}` }, { status: 500 });
  }

  return NextResponse.json(
    {
      driver: driverRow,
      temporaryPassword,
      sequenceNumber,
    },
    { status: 201 }
  );
}
