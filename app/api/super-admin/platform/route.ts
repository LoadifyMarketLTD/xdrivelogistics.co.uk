import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

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

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();

  // ── Analytics ─────────────────────────────────────────────────────────────────
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
      supabaseAdmin.from('invoices').select('id, amount, status').limit(2000),
      supabaseAdmin.from('invoices').select('id, amount').eq('status', 'Paid').limit(2000),
      supabaseAdmin.from('quotes').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('job_bids').select('id', { count: 'exact', head: true }),
    ]);

    const totalInvoiced = (invoices.data ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalRevenue = (invoicesPaid.data ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

    // Jobs trend: last 30 days grouped by week
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
        collectionRate: totalInvoiced > 0 ? Math.round((totalRevenue / totalInvoiced) * 100) : 0,
        deliveryRate: (jobs.count ?? 0) > 0 ? Math.round(((jobsDelivered.count ?? 0) / (jobs.count ?? 1)) * 100) : 0,
      },
      weeklyJobs: Object.entries(weeklyJobs).map(([week, count]) => ({ week, count })),
    });
  }

  // ── Notifications ─────────────────────────────────────────────────────────────
  if (section === 'notifications') {
    // The notifications table uses `body` (not `message`) and `read_at`
    // (timestamptz, NULL = unread) rather than a boolean `read` column.
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id, type, title, body, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return respond(200, {
        section,
        rows: [],
        summary: { total: 0, unread: 0, read: 0 },
        note: error.message,
      });
    }

    const rows = (data ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      type: r.type,
      title: r.title,
      message: (r.body as string | null) ?? '',
      read: r.read_at !== null,
      created_at: r.created_at,
    }));

    return respond(200, {
      section,
      rows,
      summary: {
        total: rows.length,
        unread: rows.filter((r) => !r.read).length,
        read: rows.filter((r) => r.read).length,
      },
    });
  }

  return respond(400, { error: 'Invalid section. Use analytics or notifications.' });
}
