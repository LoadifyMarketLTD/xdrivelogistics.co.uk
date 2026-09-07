import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type EventTimestampRow = { created_at: string | null };
type ReadinessStatus = 'healthy' | 'degraded' | 'error';
type CountSource = { count: number | null; error: { message: string } | null };

const isMissingRelation = (message: string | null | undefined) => (message ?? '').toLowerCase().includes('does not exist');
const parseTimestamp = (value: string | null): number | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { ok: false, error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { ok: false, error: 'Forbidden: active Platform Owner required.' });

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const stuckCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  const [pendingEvents, processingEvents, stuckEvents, failedEvents, failedLast24Hours, sentEvents, sentLast24Hours, latestFailure, latestSuccess, appSettings] = await Promise.all([
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']).lt('created_at', stuckCutoff),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', twentyFourHoursAgo),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    supabaseAdmin.from('notification_events').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', twentyFourHoursAgo),
    supabaseAdmin.from('notification_events').select('created_at').eq('status', 'failed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('notification_events').select('created_at').eq('status', 'sent').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('app_settings').select('key').in('key', ['supabase_project_ref', 'supabase_service_role_key']),
  ]);

  const countSources: Array<[string, CountSource]> = [
    ['pending', pendingEvents], ['processing', processingEvents], ['stuck', stuckEvents], ['failed', failedEvents],
    ['failed_24h', failedLast24Hours], ['sent', sentEvents], ['sent_24h', sentLast24Hours],
  ];
  const failedCount = countSources.find(([, source]) => source.error || typeof source.count !== 'number');
  const timestampError = latestFailure.error ?? latestSuccess.error;
  const appSettingsMissing = Boolean(appSettings.error && isMissingRelation(appSettings.error.message));
  const appSettingsFailure = appSettings.error && !appSettingsMissing ? appSettings.error : null;

  if (failedCount || timestampError || appSettingsFailure) {
    return respond(500, {
      ok: false,
      readinessStatus: 'error',
      readinessMessage: 'Email readiness could not be determined.',
      errors: [
        ...(failedCount ? [`${failedCount[0]}: ${failedCount[1].error?.message ?? 'exact count unavailable'}`] : []),
        ...(timestampError ? [timestampError.message] : []),
        ...(appSettingsFailure ? [appSettingsFailure.message] : []),
      ],
    });
  }

  const settingKeys = new Set((appSettings.data ?? []).map((row) => row.key));
  const projectRefConfigured = settingKeys.has('supabase_project_ref');
  const serviceRoleKeyConfiguredForTrigger = settingKeys.has('supabase_service_role_key');
  const triggerConfigReady = projectRefConfigured && serviceRoleKeyConfiguredForTrigger;

  const latestFailureAt = (latestFailure.data as EventTimestampRow | null)?.created_at ?? null;
  const latestSuccessAt = (latestSuccess.data as EventTimestampRow | null)?.created_at ?? null;
  const latestFailureTimestamp = parseTimestamp(latestFailureAt);
  const latestSuccessTimestamp = parseTimestamp(latestSuccessAt);
  const recovered = latestFailureTimestamp !== null && latestSuccessTimestamp !== null && latestSuccessTimestamp > latestFailureTimestamp;
  const unrecoveredFailure = latestFailureTimestamp !== null && (latestSuccessTimestamp === null || latestFailureTimestamp > latestSuccessTimestamp);

  const pendingTotal = pendingEvents.count as number;
  const processingTotal = processingEvents.count as number;
  const stuckPendingCount = stuckEvents.count as number;
  const failedTotalHistorical = failedEvents.count as number;
  const failedRecentCount = failedLast24Hours.count as number;
  const sentTotal = sentEvents.count as number;
  const sentRecentCount = sentLast24Hours.count as number;

  let readinessStatus: ReadinessStatus = 'healthy';
  let readinessMessage = 'Email delivery is operational.';
  if (!triggerConfigReady) {
    readinessStatus = 'error';
    readinessMessage = appSettingsMissing ? 'Email trigger configuration storage is unavailable.' : 'Email trigger configuration is incomplete.';
  } else if (stuckPendingCount > 0) {
    readinessStatus = 'error';
    readinessMessage = `${stuckPendingCount} email event(s) have been pending or processing for more than 15 minutes.`;
  } else if (unrecoveredFailure) {
    readinessStatus = 'error';
    readinessMessage = 'The latest email delivery attempt failed and no later success was recorded.';
  } else if (pendingTotal > 0 || processingTotal > 0) {
    readinessStatus = 'degraded';
    readinessMessage = `${pendingTotal + processingTotal} email event(s) are currently being processed.`;
  } else if (failedTotalHistorical > 0 && recovered) {
    readinessStatus = 'degraded';
    readinessMessage = `Email delivery recovered — ${failedTotalHistorical} historical failure(s). The latest delivery was successful.`;
  } else if (failedRecentCount > 0) {
    readinessStatus = 'degraded';
    readinessMessage = `${failedRecentCount} email failure(s) occurred during the last 24 hours.`;
  }

  return respond(200, {
    ok: true,
    readinessStatus,
    readinessMessage,
    checkedAt: now.toISOString(),
    notificationEvents: {
      pendingTotal,
      processingTotal,
      stuckPendingCount,
      failedTotalHistorical,
      failedLast24Hours: failedRecentCount,
      sentTotal,
      sentLast24Hours: sentRecentCount,
      latestFailureAt,
      latestSuccessAt,
      recovered,
    },
    databaseWiring: {
      appSettingsTableReadable: !appSettings.error,
      appSettingsTableMissing: appSettingsMissing,
      projectRefConfigured,
      serviceRoleKeyConfiguredForTrigger,
      triggerConfigReady,
    },
    runtimeNotes: [
      'Historical failed events are retained for audit purposes.',
      'Historical failures alone do not make the current email service unhealthy.',
      'A successful event after the latest failure indicates recovery.',
      'Pending or processing events older than 15 minutes are treated as stuck.',
      'This endpoint does not send email and does not process the queue.',
    ],
    errors: [],
  });
}
