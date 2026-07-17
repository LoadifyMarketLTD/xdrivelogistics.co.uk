import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

type PasswordUpdatePayload = {
  newPassword?: string;
};

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

  const body = (await request.json()) as PasswordUpdatePayload;
  const newPassword = body.newPassword?.trim() || '';

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
  }

  const { data: driverRow, error: driverError } = await supabaseAdmin
    .from('drivers')
    .select('id')
    .eq('user_id', authData.user.id)
    .eq('app_access', true)
    .limit(1)
    .maybeSingle();

  if (driverError || !driverRow) {
    return NextResponse.json({ error: 'Only active driver accounts can update this password flow.' }, { status: 403 });
  }

  const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
    password: newPassword,
  });

  if (updateUserError) {
    return NextResponse.json({ error: updateUserError.message }, { status: 400 });
  }

  const { error: driverUpdateError } = await supabaseAdmin
    .from('drivers')
    .update({
      must_change_password: false,
      temp_password_generated_at: null,
    })
    .eq('id', driverRow.id);

  if (driverUpdateError) {
    return NextResponse.json({ error: `Password changed but driver flag update failed: ${driverUpdateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
