import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const scalarMeta = (value: unknown) => !value || typeof value !== 'object' || Array.isArray(value)
  ? {}
  : Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item))
      .slice(0, 12));

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Event Log is temporarily unavailable.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const url = new URL(request.url);
  const from = text(url.searchParams.get('from'));
  const to = text(url.searchParams.get('to'));
  const [membershipsResult, driverResult] = await Promise.all([
    supabaseAdmin.from('company_memberships').select('company_id').eq('user_id', authData.user.id).eq('status', 'active'),
    supabaseAdmin.from('drivers').select('id').eq('user_id', authData.user.id).maybeSingle(),
  ]);
  if (membershipsResult.error || driverResult.error) return json(500, { error: 'Event Log scope could not be verified.' });
  const companyIds = [...new Set((membershipsResult.data ?? []).map((row) => text(row.company_id)).filter((value): value is string => Boolean(value)))];
  const driverId = text(driverResult.data?.id);

  let notificationsQuery = supabaseAdmin.from('notification_events')
    .select('id, event_type, entity_type, entity_id, payload, created_at')
    .eq('recipient_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (from) notificationsQuery = notificationsQuery.gte('created_at', new Date(`${from}T00:00:00`).toISOString());
  if (to) notificationsQuery = notificationsQuery.lte('created_at', new Date(`${to}T23:59:59`).toISOString());

  let jobsQuery = supabaseAdmin.from('jobs').select('id');
  const scope: string[] = [];
  for (const companyId of companyIds) {
    scope.push(`company_id.eq.${companyId}`, `assigned_company_id.eq.${companyId}`, `awarded_carrier_company_id.eq.${companyId}`);
  }
  if (driverId) scope.push(`assigned_driver_id.eq.${driverId}`);
  if (scope.length) jobsQuery = jobsQuery.or(scope.join(','));
  else jobsQuery = jobsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  const [notificationsResult, jobsResult] = await Promise.all([notificationsQuery, jobsQuery.limit(300)]);

  if (notificationsResult.error || jobsResult.error) return json(500, { error: notificationsResult.error?.message ?? jobsResult.error?.message ?? 'Event Log could not be loaded.' });
  const jobIds = (jobsResult.data ?? []).map((row) => String(row.id));
  let trackingRows: Record<string, unknown>[] = [];
  if (jobIds.length) {
    let trackingQuery = supabaseAdmin.from('job_tracking_events').select('*').in('job_id', jobIds).order('created_at', { ascending: false }).limit(1000);
    if (from) trackingQuery = trackingQuery.gte('created_at', new Date(`${from}T00:00:00`).toISOString());
    if (to) trackingQuery = trackingQuery.lte('created_at', new Date(`${to}T23:59:59`).toISOString());
    const trackingResult = await trackingQuery;
    if (trackingResult.error) return json(500, { error: trackingResult.error.message });
    trackingRows = (trackingResult.data ?? []) as Record<string, unknown>[];
  }

  const notificationEvents = (notificationsResult.data ?? []).map((row) => ({
    id: String(row.id),
    event_type: row.event_type ?? null,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    payload: { ...(row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload as Record<string, unknown> : {}), source: 'notification' },
    created_at: row.created_at ?? null,
    source: 'notification',
    job_id: row.entity_type === 'job' ? row.entity_id ?? null : text((row.payload as Record<string, unknown> | null)?.job_id),
  }));

  const trackingEvents = trackingRows.map((row) => {
    const jobId = text(row.job_id);
    const meta = scalarMeta(row.meta);
    return {
      id: `tracking-${text(row.id) ?? crypto.randomUUID()}`,
      event_type: text(row.event_type) ?? 'tracking_update',
      entity_type: 'job',
      entity_id: jobId,
      payload: {
        ...meta,
        source: 'tracking',
        job_id: jobId,
        message: text(row.message) ?? text(row.note),
        actor_user_id: text(row.user_id) ?? text(row.created_by),
      },
      created_at: text(row.event_time) ?? text(row.created_at),
      source: 'tracking',
      job_id: jobId,
    };
  });

  const events = [...notificationEvents, ...trackingEvents]
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
    .slice(0, 1200);
  return json(200, {
    events,
    generatedAt: new Date().toISOString(),
    sources: { notifications: notificationEvents.length, tracking: trackingEvents.length },
    note: 'Tracking lifecycle is combined with account notifications. Login/logout events are not fabricated when no verified login-audit source is exposed.',
  });
}
