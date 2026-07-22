import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformOwner } from '../../_lib/platformAuth';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { getEffectiveJobStatus, getInvoiceState, isActiveExecutionStatus } from '../../../../lib/workspaceClassifiers';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type NotificationEventRow = {
  id: string;
  event_type: string;
  entity_id: string;
  recipient_user_id: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
  processed_at: string | null;
};

const notificationTitle = (eventType: string) => {
  switch (eventType) {
    case 'job_assigned': return 'Job assigned';
    case 'bid_accepted': return 'Bid accepted';
    case 'pod_uploaded': return 'POD uploaded';
    case 'invoice_created': return 'Invoice created';
    case 'invoice_overdue': return 'Invoice overdue';
    default: return eventType.replace(/_/g, ' ');
  }
};

const safeNotificationMessage = (row: NotificationEventRow) => {
  const payload = row.payload ?? {};
  const pickup = typeof payload.pickup_location === 'string' ? payload.pickup_location : null;
  const delivery = typeof payload.delivery_location === 'string' ? payload.delivery_location : null;
  switch (row.event_type) {
    case 'job_assigned':
      return `${pickup ?? 'Collection TBC'} → ${delivery ?? 'Delivery TBC'}`;
    case 'bid_accepted':
      return 'A carrier bid has been accepted.';
    case 'pod_uploaded':
      return 'Proof of delivery was uploaded.';
    case 'invoice_created':
      return 'An invoice was created.';
    case 'invoice_overdue':
      return 'An invoice passed its recorded due date.';
    default:
      return 'Persisted platform event.';
  }
};

export async function GET(request: NextRequest) {
  const access = await requirePlatformOwner(request);
  if (!access.ok) return respond(access.failure.status, { error: access.failure.error });
  if (!supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();

  if (section === 'analytics') {
    const [companies, companiesActive, drivers, jobs, invoices, quotes, bids] = await Promise.all([
      supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('drivers').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('id, status, current_status, created_at').limit(5000),
      supabaseAdmin.from('invoices').select('id, amount, status, payment_status, due_date').limit(5000),
      supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('job_bids').select('id', { count: 'exact', head: true }),
    ]);

    const requiredResults = [companies, companiesActive, drivers, jobs, invoices, quotes, bids];
    const failed = requiredResults.find((result) => result.error);
    if (failed?.error) return respond(500, { error: failed.error.message, degraded: true });

    const jobRows = jobs.data ?? [];
    const deliveredJobs = jobRows.filter((job) => ['delivered', 'completed', 'invoiced', 'paid'].includes(getEffectiveJobStatus(job))).length;
    const activeJobs = jobRows.filter((job) => isActiveExecutionStatus(getEffectiveJobStatus(job))).length;
    const invoiceRows = invoices.data ?? [];
    const totalInvoiced = invoiceRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const paidRevenue = invoiceRows.filter((row) => getInvoiceState(row).paid).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const overdueInvoices = invoiceRows.filter((row) => getInvoiceState(row).overdue).length;

    const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
    const weeklyJobs: Record<string, number> = {};
    for (const job of jobRows) {
      const createdAt = new Date(String(job.created_at ?? '')).getTime();
      if (!Number.isFinite(createdAt) || createdAt < thirtyDaysAgo) continue;
      const date = new Date(createdAt);
      const week = `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleString('en-GB', { month: 'short' })}`;
      weeklyJobs[week] = (weeklyJobs[week] ?? 0) + 1;
    }

    return respond(200, {
      section,
      kpis: {
        totalCompanies: companies.count ?? 0,
        activeCompanies: companiesActive.count ?? 0,
        totalDrivers: drivers.count ?? 0,
        totalJobs: jobRows.length,
        deliveredJobs,
        activeJobs,
        totalQuotes: quotes.count ?? 0,
        totalBids: bids.count ?? 0,
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalRevenue: Math.round(paidRevenue * 100) / 100,
        overdueInvoices,
        paymentStatusRate: totalInvoiced > 0 ? Math.round((paidRevenue / totalInvoiced) * 100) : 0,
        deliveryRate: jobRows.length > 0 ? Math.round((deliveredJobs / jobRows.length) * 100) : 0,
      },
      weeklyJobs: Object.entries(weeklyJobs).map(([week, count]) => ({ week, count })),
      degraded: false,
    });
  }

  if (section === 'notifications') {
    const limitParam = Number(searchParams.get('limit') ?? 200);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 200;
    const { data, error } = await supabaseAdmin
      .from('notification_events')
      .select('id, event_type, entity_id, recipient_user_id, payload, status, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return respond(503, {
        error: 'Platform notifications are temporarily unavailable.',
        detail: error.message,
        degraded: true,
      });
    }

    const rows = ((data ?? []) as NotificationEventRow[]).map((row) => ({
      id: row.id,
      user_id: row.recipient_user_id,
      type: row.event_type,
      title: notificationTitle(row.event_type),
      message: safeNotificationMessage(row),
      status: row.status,
      processed: row.processed_at !== null,
      created_at: row.created_at,
    }));

    return respond(200, {
      section,
      rows,
      summary: {
        total: rows.length,
        pending: rows.filter((row) => row.status === 'pending').length,
        sent: rows.filter((row) => row.status === 'sent').length,
        delivered: rows.filter((row) => row.status === 'delivered').length,
        failed: rows.filter((row) => row.status === 'failed').length,
        skipped: rows.filter((row) => row.status === 'skipped').length,
      },
      degraded: false,
    });
  }

  return respond(400, { error: 'Invalid section. Use analytics or notifications.' });
}
