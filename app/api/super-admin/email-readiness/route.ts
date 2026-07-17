import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { role: string | null };
};

const isMissingRelation = (message: string | null | undefined) =>
  (message ?? '').toLowerCase().includes('does not exist');

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { ok: false, error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { ok: false, error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { ok: false, error: 'Unauthorized: invalid or expired token.' });
  }

  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') {
    return respond(403, { ok: false, error: 'Forbidden: owner role required.' });
  }

  const [pendingEvents, failedEvents, sentEvents, appSettings] = await Promise.all([
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    supabaseAdmin.from('app_settings').select('key').in('key', ['supabase_project_ref', 'supabase_service_role_key']),
  ]);

  const eventErrors = [pendingEvents.error, failedEvents.error, sentEvents.error]
    .filter((error): error is NonNullable<typeof pendingEvents.error> => Boolean(error))
    .map((error) => error.message);

  const appSettingsMissing = Boolean(appSettings.error && isMissingRelation(appSettings.error.message));
  const appSettingsErrors = appSettings.error && !appSettingsMissing ? [appSettings.error.message] : [];
  const settingKeys = new Set((appSettings.data ?? []).map((row) => row.key));
  const errors = [...eventErrors, ...appSettingsErrors];

  return respond(errors.length ? 500 : 200, {
    ok: errors.length === 0,
    notificationEvents: {
      pending: pendingEvents.count ?? 0,
      failed: failedEvents.count ?? 0,
      sent: sentEvents.count ?? 0,
    },
    databaseWiring: {
      appSettingsTableReadable: !appSettings.error,
      appSettingsTableMissing: appSettingsMissing,
      projectRefConfigured: settingKeys.has('supabase_project_ref'),
      serviceRoleKeyConfiguredForTrigger: settingKeys.has('supabase_service_role_key'),
    },
    runtimeNotes: [
      'This endpoint does not send email and does not process the queue.',
      'RESEND_API_KEY and Edge Function deployment must be verified in Supabase dashboard or function logs.',
      'Pending events mean the queue is not being processed automatically.',
      'Failed events mean processing ran but email delivery or configuration failed.',
      'Run supabase/diagnostics/email_readiness_audit.sql for trigger/function/pg_net checks.',
    ],
    errors,
  });
}