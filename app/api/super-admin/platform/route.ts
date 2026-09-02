import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';
import {
  isMissingDurabilityColumnError,
  normalizeBaseRow,
  normalizeDurabilityRow,
  type NotificationEventBaseRow,
  type NotificationEventDurabilityRow,
  type NotificationEventRow,
} from '../_lib/notificationEvents';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error } = await validatorClient.auth.getUser(token);
  if (error || !authData.user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

const getNotificationTitle = (eventType: string) => {
  switch (eventType) {
    case 'job_assigned':
      return 'Job assigned';
    case 'bid_accepted':
      return 'Bid accepted';
    case 'pod_uploaded':
      return 'POD uploaded';
    default:
      return 'Notification event';
  }
};

const getNotificationMessage = (row: NotificationEventRow) => {
  const payload = row.payload ?? {};
  const pickup = typeof payload.pickup_location === 'string' ? payload.pickup_location : null;
  const delivery = typeof payload.delivery_location === 'string' ? payload.delivery_location : null;

  switch (row.event_type) {
    case 'job_assigned':
      return `${pickup ?? 'TBC'} → ${delivery ?? 'TBC'}`;
    case 'bid_accepted': {
      const amountCandidates = [payload.bid_price_gbp, payload.amount, payload.bid_amount];
      const numericAmount = amountCandidates.find((value) => typeof value === 'number');
      return typeof numericAmount === 'number'
        ? `Accepted amount: £${numericAmount.toFixed(2)}`
        : 'A carrier bid has been accepted.';
    }
    case 'pod_uploaded':
      return `${pickup ?? 'Pickup'} → ${delivery ?? 'Delivery'} marked delivered.`;
    default:
      return `Entity ${row.entity_id}`;
  }
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();

  if (section === 'analytics') {
    const [
      companies,
      companiesActive,
      drivers,
      jobs,
      jobsDelivered,
      jobsOpen,
      invoices,
      invoicesPaid,
      quotes,
      bids,
    ] = await Promise.all([
      supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['posted', 'allocated', 'in_transit']),
      supabaseAdmin.from('invoices').select('id, amount, payment_status').limit(2000),
      supabaseAdmin.from('invoices').select('id, amount').eq('payment_status', 'paid').limit(2000),
      supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('job_bids').select('id', { count: 'exact', head: true }),
    ]);

    const totalInvoiced = (invoices.data ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalRevenue = (invoicesPaid.data ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recentJobs } = await supabaseAdmin
      .from('jobs')
      .select('id, status, created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    const weeklyJobs: Record<string, number> = {};
    for (const job of (recentJobs ?? [])) {
      const week = `W${Math.ceil(new Date(job.created_at as string).getDate() / 7)} ${new Date(job.created_at as string).toLocaleString('en-GB', { month: 'short' })}`;
      weeklyJobs[week] = (weeklyJobs[week] ?? 0) + 1;
    }

    return respond(200, {
      section,
      kpis: {
        totalCompanies: companies.count ?? 0,
        activeCompanies: companiesActive.count ?? 0,
        totalDrivers: drivers.count ?? 0,
        totalJobs: jobs.count ?? 0,
        deliveredJobs: jobsDelivered.count ?? 0,
        activeJobs: jobsOpen.count ?? 0,
        totalQuotes: quotes.count ?? 0,
        totalBids: bids.count ?? 0,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        paymentStatusRate: totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0,
        deliveryRate: (jobs.count ?? 0) > 0 ? Math.round(((jobsDelivered.count ?? 0) / (jobs.count ?? 1)) * 100) : 0,
      },
      weeklyJobs: Object.entries(weeklyJobs).map(([week, count]) => ({ week, count })),
    });
  }

  if (section === 'notifications') {
    const primaryResult = await supabaseAdmin
      .from('notification_events')
      .select('id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at, last_error, attempt_count, next_attempt_at')
      .returns<NotificationEventDurabilityRow[]>()
      .order('created_at', { ascending: false })
      .limit(200);

    let durabilityUnavailable = false;
    let normalizedRows: NotificationEventRow[];

    if (primaryResult.error) {
      if (isMissingDurabilityColumnError(primaryResult.error)) {
        const fallbackResult = await supabaseAdmin
          .from('notification_events')
          .select('id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at')
          .returns<NotificationEventBaseRow[]>()
          .order('created_at', { ascending: false })
          .limit(200);

        if (fallbackResult.error) {
          return respond(500, {
            section,
            error: 'Failed to load notification events.',
            diagnosticCode: 'NOTIFICATION_EVENTS_FALLBACK_QUERY_FAILED',
            detail: fallbackResult.error.message,
            sourceCode: fallbackResult.error.code ?? null,
          });
        }
        normalizedRows = (fallbackResult.data ?? []).map(normalizeBaseRow);
        durabilityUnavailable = true;
      } else {
        return respond(500, {
          section,
          error: 'Failed to load notification events.',
          diagnosticCode: 'NOTIFICATION_EVENTS_QUERY_FAILED',
          detail: primaryResult.error.message,
          sourceCode: primaryResult.error.code ?? null,
        });
      }
    } else {
      normalizedRows = (primaryResult.data ?? []).map(normalizeDurabilityRow);
    }

    const rows = normalizedRows.map((r) => ({
      id: r.id,
      user_id: r.recipient_user_id,
      type: r.event_type,
      title: getNotificationTitle(r.event_type),
      message: getNotificationMessage(r),
      status: r.status,
      processed: r.processed_at !== null,
      created_at: r.created_at,
      last_error: r.last_error,
      attempt_count: r.attempt_count,
      next_attempt_at: r.next_attempt_at,
    }));

    return respond(200, {
      section,
      rows,
      summary: {
        total: rows.length,
        pending: rows.filter((r) => r.status === 'pending').length,
        sent: rows.filter((r) => r.status === 'sent').length,
        failed: rows.filter((r) => r.status === 'failed').length,
        skipped: rows.filter((r) => r.status === 'skipped').length,
      },
      ...(durabilityUnavailable
        ? { diagnosticNote: 'error detail unavailable — notification_events durability columns (last_error, attempt_count) have not been applied in the connected schema' }
        : {}),
    });
  }

  return respond(400, { error: 'Invalid section. Use analytics or notifications.' });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    if (isSuperAdminDeployPreviewReadOnly()) {
      return respond(403, { error: 'Deploy Preview is read-only. Notification retry was not changed.' });
    }
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  const body = await request.json().catch(() => null) as { section?: string; action?: string; notificationId?: string; reason?: string } | null;
  const section = String(body?.section ?? '').toLowerCase();
  const action = String(body?.action ?? '').toLowerCase();
  const notificationId = String(body?.notificationId ?? '').trim();
  const reason = String(body?.reason ?? '').trim();

  if (section !== 'notifications' || action !== 'retry' || !notificationId) {
    return respond(400, { error: 'Invalid action payload.' });
  }
  if (reason.length < 5) {
    return respond(400, { error: 'A notification retry reason of at least 5 characters is required.' });
  }

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
      return respond(503, {
        error: 'Platform notification retry governance schema is not applied in this environment.',
        migrationRequired: '20260902091000_platform_notification_retry_governance.sql',
      });
    }
    return respond(500, { error: error.message });
  }

  const reconciliation = Array.isArray(data) ? data[0] ?? null : data;
  return respond(200, { success: true, notificationId, retry: reconciliation });
}
