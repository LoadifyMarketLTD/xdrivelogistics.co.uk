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

type CompanyRow = { id: string; name: string };
type DisputeRow = {
  id: string;
  invoice_id: string | null;
  company_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};
type ReviewRow = {
  id: string;
  company_id: string | null;
  reviewer_id: string | null;
  rating: number | null;
  comment: string | null;
  created_at: string;
};
type NotificationTicketRow = {
  id: string;
  company_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
  processed_at: string | null;
};

const companyNameMap = async (ids: string[]): Promise<Map<string, string>> => {
  if (!supabaseAdmin || ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  return new Map((data as CompanyRow[] ?? []).map((c) => [c.id, c.name]));
};

const mapTicketStatus = (status: string) => {
  if (status === 'sent') return 'resolved';
  if (status === 'skipped') return 'investigating';
  return 'open';
};

const mapTicketPriority = (status: string) => {
  if (status === 'failed') return 'high';
  if (status === 'pending') return 'medium';
  if (status === 'skipped') return 'medium';
  return 'low';
};

const mapTicketSubject = (eventType: string, payload: Record<string, unknown> | null) => {
  const safePayload = payload ?? {};
  const jobId = typeof safePayload.job_id === 'string' ? safePayload.job_id : null;
  const invoiceId = typeof safePayload.invoice_id === 'string' ? safePayload.invoice_id : null;

  switch (eventType) {
    case 'job_assigned':
      return jobId ? `Job assignment event (${jobId.slice(0, 8)})` : 'Job assignment event';
    case 'pod_uploaded':
      return jobId ? `POD uploaded event (${jobId.slice(0, 8)})` : 'POD uploaded event';
    case 'bid_accepted':
      return jobId ? `Bid accepted event (${jobId.slice(0, 8)})` : 'Bid accepted event';
    case 'invoice_disputed':
      return invoiceId ? `Invoice disputed (${invoiceId.slice(0, 8)})` : 'Invoice disputed';
    default:
      return eventType.replace(/_/g, ' ');
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
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  // ── Disputes ─────────────────────────────────────────────────────────────────
  if (section === 'disputes') {
    const { data, error } = await supabaseAdmin
      .from('invoice_disputes')
      .select('id, invoice_id, company_id, reason, details, status, resolution_note, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return respond(500, { error: error.message });

    const rows = (data as DisputeRow[] | null) ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    return respond(200, {
      section,
      rows: rows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
      })),
      summary: {
        total: rows.length,
        open: rows.filter((r) => r.status === 'open').length,
        investigating: rows.filter((r) => r.status === 'investigating').length,
        resolved: rows.filter((r) => r.status === 'resolved').length,
        closed: rows.filter((r) => r.status === 'closed').length,
      },
    });
  }

  // ── Complaints (reviews) ─────────────────────────────────────────────────────
  if (section === 'complaints') {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, company_id, reviewer_id, rating, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // reviews table may not exist yet; return graceful empty response
      return respond(200, {
        section,
        rows: [],
        summary: { total: 0, low_rated: 0, average_rating: null },
        note: 'No complaints data available. Reviews table may not be populated yet.',
      });
    }

    const rows = (data as ReviewRow[] | null) ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const ratings = rows.map((r) => Number(r.rating)).filter((n) => !isNaN(n));
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    return respond(200, {
      section,
      rows: rows.map((r) => ({
        ...r,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
      })),
      summary: {
        total: rows.length,
        low_rated: rows.filter((r) => Number(r.rating) <= 2).length,
        average_rating: avgRating,
      },
    });
  }

  // ── Tickets ───────────────────────────────────────────────────────────────────
  if (section === 'tickets') {
    const { data, error } = await supabaseAdmin
      .from('notification_events')
      .select('id, company_id, event_type, payload, status, created_at, processed_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return respond(200, {
        section,
        rows: [],
        summary: { total: 0, open: 0, investigating: 0, resolved: 0, closed: 0 },
        note: 'No support tickets available. notification_events table may not be populated yet.',
      });
    }

    const rows = (data as NotificationTicketRow[] | null) ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const ticketRows = rows.map((r) => {
      const status = mapTicketStatus(r.status);
      return {
        id: r.id,
        company_name: nameById.get(r.company_id as string) ?? 'Unknown',
        subject: mapTicketSubject(r.event_type, r.payload),
        status,
        priority: mapTicketPriority(r.status),
        created_at: r.created_at,
        resolved_at: status === 'resolved' ? r.processed_at : null,
      };
    });

    return respond(200, {
      section,
      rows: ticketRows,
      summary: {
        total: ticketRows.length,
        open: ticketRows.filter((row) => row.status === 'open').length,
        investigating: ticketRows.filter((row) => row.status === 'investigating').length,
        resolved: ticketRows.filter((row) => row.status === 'resolved').length,
        closed: ticketRows.filter((row) => row.status === 'closed').length,
      },
    });
  }

  return respond(400, { error: 'Invalid section. Use disputes, complaints, or tickets.' });
}
