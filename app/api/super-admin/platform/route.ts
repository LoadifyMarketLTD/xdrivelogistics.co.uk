import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import {
  isMissingDurabilityColumnError,
  normalizeBaseRow,
  normalizeDurabilityRow,
  type NotificationEventBaseRow,
  type NotificationEventDurabilityRow,
  type NotificationEventRow,
} from '../_lib/notificationEvents';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../_lib/verifyPlatformOwner';
import { isInvoiceFullyPaid, toCanonicalInvoiceDisplayStatus } from '../../../../lib/invoiceStatus';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const SOURCE_PAGE_SIZE = 1000;
const OPEN_JOB_STATUSES = [
  'draft', 'received', 'posted', 'quoted', 'awarded', 'allocated', 'accepted', 'assigned',
  'on_my_way', 'on_my_way_to_pickup', 'on_site_pickup', 'loaded', 'collected', 'in_transit',
  'on_my_way_to_delivery', 'on_site_delivery', 'in_progress', 'OPEN', 'open',
];

type AnalyticsInvoiceRow = {
  id: string;
  amount: number | string | null;
  status: string | null;
  payment_status: string | null;
  due_date: string | null;
  currency: string | null;
};
type AnalyticsJobRow = { id: string; status: string | null; created_at: string };

const loadAllAnalyticsInvoices = async () => {
  if (!supabaseAdmin) return { rows: [] as AnalyticsInvoiceRow[], error: 'Server auth is not configured.' };
  const rows: AnalyticsInvoiceRow[] = [];
  for (let offset = 0; ; offset += SOURCE_PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('invoices')
      .select('id, amount, status, payment_status, due_date, currency')
      .order('id', { ascending: true })
      .range(offset, offset + SOURCE_PAGE_SIZE - 1);
    if (result.error) return { rows: [] as AnalyticsInvoiceRow[], error: result.error.message };
    const page = (result.data ?? []) as AnalyticsInvoiceRow[];
    rows.push(...page);
    if (page.length < SOURCE_PAGE_SIZE) break;
  }
  return { rows, error: null as string | null };
};

const loadRecentAnalyticsJobs = async (fromIso: string) => {
  if (!supabaseAdmin) return { rows: [] as AnalyticsJobRow[], error: 'Server auth is not configured.' };
  const rows: AnalyticsJobRow[] = [];
  for (let offset = 0; ; offset += SOURCE_PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('jobs')
      .select('id, status, created_at')
      .gte('created_at', fromIso)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + SOURCE_PAGE_SIZE - 1);
    if (result.error) return { rows: [] as AnalyticsJobRow[], error: result.error.message };
    const page = (result.data ?? []) as AnalyticsJobRow[];
    rows.push(...page);
    if (page.length < SOURCE_PAGE_SIZE) break;
  }
  return { rows, error: null as string | null };
};

const loadAllNotificationRows = async () => {
  if (!supabaseAdmin) return { rows: [] as NotificationEventRow[], durabilityUnavailable: false, error: 'Server auth is not configured.' };
  const durabilityRows: NotificationEventDurabilityRow[] = [];
  for (let offset = 0; ; offset += SOURCE_PAGE_SIZE) {
    const result = await supabaseAdmin
      .from('notification_events')
      .select('id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at, last_error, attempt_count, next_attempt_at')
      .returns<NotificationEventDurabilityRow[]>()
      .order('created_at', { ascending: false })
      .range(offset, offset + SOURCE_PAGE_SIZE - 1);
    if (result.error) {
      if (!isMissingDurabilityColumnError(result.error)) {
        return { rows: [] as NotificationEventRow[], durabilityUnavailable: false, error: result.error.message };
      }
      const baseRows: NotificationEventBaseRow[] = [];
      for (let baseOffset = 0; ; baseOffset += SOURCE_PAGE_SIZE) {
        const fallback = await supabaseAdmin
          .from('notification_events')
          .select('id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at')
          .returns<NotificationEventBaseRow[]>()
          .order('created_at', { ascending: false })
          .range(baseOffset, baseOffset + SOURCE_PAGE_SIZE - 1);
        if (fallback.error) return { rows: [] as NotificationEventRow[], durabilityUnavailable: true, error: fallback.error.message };
        const page = fallback.data ?? [];
        baseRows.push(...page);
        if (page.length < SOURCE_PAGE_SIZE) break;
      }
      return { rows: baseRows.map(normalizeBaseRow), durabilityUnavailable: true, error: null as string | null };
    }
    const page = result.data ?? [];
    durabilityRows.push(...page);
    if (page.length < SOURCE_PAGE_SIZE) break;
  }
  return { rows: durabilityRows.map(normalizeDurabilityRow), durabilityUnavailable: false, error: null as string | null };
};

const getNotificationTitle = (eventType: string) => {
  switch (eventType) {
    case 'job_assigned': return 'Job assigned';
    case 'bid_accepted': return 'Bid accepted';
    case 'pod_uploaded': return 'POD uploaded';
    default: return 'Notification event';
  }
};

const getNotificationMessage = (row: NotificationEventRow) => {
  const payload = row.payload ?? {};
  const pickup = typeof payload.pickup_location === 'string' ? payload.pickup_location : null;
  const delivery = typeof payload.delivery_location === 'string' ? payload.delivery_location : null;
  switch (row.event_type) {
    case 'job_assigned': return `${pickup ?? 'TBC'} → ${delivery ?? 'TBC'}`;
    case 'bid_accepted': {
      const numericAmount = [payload.bid_price_gbp, payload.amount, payload.bid_amount].find((value) => typeof value === 'number');
      return typeof numericAmount === 'number' ? `Accepted amount: £${numericAmount.toFixed(2)}` : 'A carrier bid has been accepted.';
    }
    case 'pod_uploaded': return `${pickup ?? 'Pickup'} → ${delivery ?? 'Delivery'} marked delivered.`;
    default: return `Entity ${row.entity_id}`;
  }
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();

  if (section === 'analytics') {
    const [companies, companiesActive, drivers, jobs, jobsDelivered, jobsOpen, quotes, bids, invoicesResult] = await Promise.all([
      supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).in('status', OPEN_JOB_STATUSES),
      supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('job_bids').select('id', { count: 'exact', head: true }),
      loadAllAnalyticsInvoices(),
    ]);

    const countSources = [
      ['companies_total', companies], ['companies_active', companiesActive], ['drivers_total', drivers],
      ['jobs_total', jobs], ['jobs_delivered', jobsDelivered], ['jobs_open', jobsOpen],
      ['quotes_total', quotes], ['bids_total', bids],
    ] as const;
    const failed = countSources.find(([, source]) => source.error || typeof source.count !== 'number');
    if (failed) return respond(500, { error: `Platform analytics source unavailable: ${failed[0]}.`, detail: failed[1].error?.message ?? 'exact count unavailable' });
    if (invoicesResult.error) return respond(500, { error: 'Platform analytics invoice source unavailable.', detail: invoicesResult.error });

    const displayInvoices = invoicesResult.rows.map((row) => ({
      ...row,
      displayStatus: toCanonicalInvoiceDisplayStatus(row.status, row.due_date, row.payment_status),
    }));
    const issuedRows = displayInvoices.filter((row) => row.displayStatus !== 'Draft' && row.displayStatus !== 'Cancelled');
    const paidRows = issuedRows.filter((row) => isInvoiceFullyPaid(row.payment_status));
    const currencies = Array.from(new Set(issuedRows.map((row) => String(row.currency ?? '').trim().toUpperCase()).filter(Boolean)));
    if (currencies.length > 1) {
      return respond(409, {
        error: 'Platform analytics contains multiple invoice currencies. Monetary KPIs were not combined.',
        currencies,
        diagnosticCode: 'MULTI_CURRENCY_ANALYTICS_REQUIRES_BREAKDOWN',
      });
    }
    const currency = currencies[0] ?? 'GBP';
    const totalInvoiced = issuedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const totalRevenue = paidRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const recentJobsResult = await loadRecentAnalyticsJobs(thirtyDaysAgo);
    if (recentJobsResult.error) return respond(500, { error: 'Platform analytics trend source unavailable.', detail: recentJobsResult.error });

    const weeklyJobs: Record<string, number> = {};
    for (const job of recentJobsResult.rows) {
      const created = new Date(job.created_at);
      if (!Number.isFinite(created.getTime())) continue;
      const weekStart = new Date(created);
      const day = (weekStart.getUTCDay() + 6) % 7;
      weekStart.setUTCDate(weekStart.getUTCDate() - day);
      weekStart.setUTCHours(0, 0, 0, 0);
      const key = weekStart.toISOString().slice(0, 10);
      weeklyJobs[key] = (weeklyJobs[key] ?? 0) + 1;
    }

    return respond(200, {
      section,
      refreshedAt: new Date().toISOString(),
      currency,
      kpis: {
        totalCompanies: companies.count,
        activeCompanies: companiesActive.count,
        totalDrivers: drivers.count,
        totalJobs: jobs.count,
        deliveredJobs: jobsDelivered.count,
        activeJobs: jobsOpen.count,
        openJobs: jobsOpen.count,
        totalQuotes: quotes.count,
        totalBids: bids.count,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        paymentStatusRate: totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0,
        deliveryRate: (jobs.count as number) > 0 ? Math.round(((jobsDelivered.count as number) / (jobs.count as number)) * 100) : 0,
      },
      weeklyJobs: Object.entries(weeklyJobs).sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, count]) => ({ week: weekStart, count })),
    });
  }

  if (section === 'notifications') {
    const source = await loadAllNotificationRows();
    if (source.error) {
      return respond(500, {
        section,
        error: 'Failed to load notification events.',
        diagnosticCode: 'NOTIFICATION_EVENTS_QUERY_FAILED',
        detail: source.error,
      });
    }
    const rows = source.rows.map((row) => ({
      id: row.id,
      user_id: row.recipient_user_id,
      type: row.event_type,
      title: getNotificationTitle(row.event_type),
      message: getNotificationMessage(row),
      status: row.status,
      processed: row.processed_at !== null,
      created_at: row.created_at,
      last_error: row.last_error,
      attempt_count: row.attempt_count,
      next_attempt_at: row.next_attempt_at,
    }));
    return respond(200, {
      section,
      rows,
      summary: {
        total: rows.length,
        pending: rows.filter((row) => row.status === 'pending').length,
        sent: rows.filter((row) => row.status === 'sent').length,
        failed: rows.filter((row) => row.status === 'failed').length,
        skipped: rows.filter((row) => row.status === 'skipped').length,
      },
      ...(source.durabilityUnavailable ? { diagnosticNote: 'Notification durability details are unavailable in the connected schema.' } : {}),
    });
  }

  return respond(400, { error: 'Invalid section. Use analytics or notifications.' });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    if (isSuperAdminDeployPreviewReadOnly()) return respond(403, { error: 'Deploy Preview is read-only. Notification retry was not changed.' });
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  const body = await request.json().catch(() => null) as { section?: string; action?: string; notificationId?: string; reason?: string } | null;
  const section = String(body?.section ?? '').toLowerCase();
  const action = String(body?.action ?? '').toLowerCase();
  const notificationId = String(body?.notificationId ?? '').trim();
  const reason = String(body?.reason ?? '').trim();
  if (section !== 'notifications' || action !== 'retry' || !notificationId) return respond(400, { error: 'Invalid action payload.' });
  if (reason.length < 5) return respond(400, { error: 'A notification retry reason of at least 5 characters is required.' });

  const { data, error } = await supabaseAdmin.rpc('owner_retry_notification_event', {
    p_actor_user_id: owner.id,
    p_notification_id: notificationId,
    p_reason: reason,
  });
  if (error) {
    if (error.code === 'P0002') return respond(404, { error: error.message });
    if (error.code === '23514' || error.code === '23502') return respond(409, { error: error.message });
    if (error.code === '42501') return respond(403, { error: error.message });
    if (error.code === '42883' || error.code === 'PGRST202') {
      return respond(503, { error: 'Platform notification retry governance schema is not applied in this environment.', migrationRequired: '20260902091000_platform_notification_retry_governance.sql' });
    }
    return respond(500, { error: error.message });
  }

  const reconciliation = Array.isArray(data) ? data[0] ?? null : data;
  return respond(200, { success: true, notificationId, retry: reconciliation });
}
