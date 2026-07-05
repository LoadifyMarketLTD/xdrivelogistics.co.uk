import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
type SupportTicketRow = {
  id: string;
  company_id: string | null;
  raised_by_user_id: string | null;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assigned_to_user_id: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};
type UserFeedbackRow = {
  id: string;
  user_id: string | null;
  company_id: string | null;
  rating: number | null;
  category: string;
  message: string;
  page_url: string | null;
  created_at: string;
};

const createTicketSchema = z.object({
  company_id: z.string().uuid().optional(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.enum(['billing', 'operations', 'technical', 'compliance', 'general']).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

const companyNameMap = async (ids: string[]): Promise<Map<string, string>> => {
  if (!supabaseAdmin || ids.length === 0) return new Map();
  const { data } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  return new Map((data as CompanyRow[] ?? []).map((c) => [c.id, c.name]));
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
      .from('support_tickets')
      .select('id, company_id, raised_by_user_id, subject, description, category, priority, status, assigned_to_user_id, resolution_note, resolved_at, closed_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return respond(200, {
        section,
        rows: [],
        summary: { total: 0, open: 0, investigating: 0, resolved: 0, closed: 0 },
        note: 'No support tickets available yet.',
      });
    }

    const rows = (data as SupportTicketRow[] | null) ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const ticketRows = rows.map((r) => ({
      id: r.id,
      company_name: nameById.get(r.company_id as string) ?? 'Unknown',
      subject: r.subject,
      description: r.description,
      category: r.category,
      priority: r.priority,
      status: r.status,
      resolution_note: r.resolution_note,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      closed_at: r.closed_at,
      updated_at: r.updated_at,
    }));

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

  // ── User Feedback ─────────────────────────────────────────────────────────────
  if (section === 'feedback') {
    const { data, error } = await supabaseAdmin
      .from('user_feedback')
      .select('id, user_id, company_id, rating, category, message, page_url, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return respond(200, {
        section,
        rows: [],
        summary: { total: 0, average_rating: null },
        note: 'No user feedback available yet.',
      });
    }

    const rows = (data as UserFeedbackRow[] | null) ?? [];
    const nameById = await companyNameMap(
      Array.from(new Set(rows.map((r) => r.company_id as string).filter(Boolean))),
    );

    const ratings = rows.map((r) => Number(r.rating)).filter((n) => !isNaN(n) && n > 0);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    const feedbackRows = rows.map((r) => ({
      id: r.id,
      company_name: nameById.get(r.company_id as string) ?? 'Unknown',
      rating: r.rating,
      category: r.category,
      message: r.message,
      page_url: r.page_url,
      created_at: r.created_at,
    }));

    return respond(200, {
      section,
      rows: feedbackRows,
      summary: {
        total: feedbackRows.length,
        average_rating: avgRating,
        bug_reports: feedbackRows.filter((r) => r.category === 'bug').length,
        feature_requests: feedbackRows.filter((r) => r.category === 'feature_request').length,
      },
    });
  }

  return respond(400, { error: 'Invalid section. Use disputes, complaints, tickets, or feedback.' });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: owner role required.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { company_id, subject, description, category, priority } = parsed.data;

  const { data: ticket, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      company_id: company_id ?? null,
      raised_by_user_id: owner.id,
      subject,
      description: description ?? null,
      category,
      priority,
      status: 'open',
    })
    .select('id, company_id, subject, category, priority, status, created_at')
    .single();

  if (error) return respond(500, { error: error.message });

  return respond(201, { ticket });
}
