import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

type DeletePayload = {
  password?: string;
  confirmationText?: string;
};

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not available — admin client not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — no bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Unauthorized — invalid token.' });

  const payload = (await request.json().catch(() => null)) as DeletePayload | null;
  if (!payload || payload.confirmationText !== 'DELETE') {
    return json(400, { error: 'Invalid confirmation payload.' });
  }
  if (!payload.password || payload.password.trim().length < 8) {
    return json(400, { error: 'Password is required for re-authentication.' });
  }
  if (!user.email) return json(400, { error: 'User email is required for re-authentication.' });

  const { error: reauthError } = await validatorClient.auth.signInWithPassword({
    email: user.email,
    password: payload.password,
  });
  if (reauthError) {
    return json(401, { error: 'Re-authentication failed. Please verify your password.' });
  }

  await supabaseAdmin.from('owner_audit_log').insert({
    actor_user_id: user.id,
    action: 'gdpr_account_delete_requested',
    target_type: 'user',
    target_id: user.id,
    notes: 'GDPR account deletion requested by user via /api/account/delete',
  }).then(() => null).catch(() => null);

  const { data: deletionResult, error: deletionError } = await supabaseAdmin.rpc('fn_gdpr_delete_user', {
    p_user_id: user.id,
  });

  if (deletionError) {
    return json(500, { error: `Failed to delete account data: ${deletionError.message}` });
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    return json(500, { error: `Auth account deletion failed: ${authDeleteError.message}` });
  }

  return json(200, {
    success: true,
    deletedUserId: user.id,
    dataResult: deletionResult,
  });
}
