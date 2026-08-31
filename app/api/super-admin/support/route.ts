import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205']);

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
type SupportTicketMutationRow = {
  ticket_id: string;
  status: string;
  resolution_note: string;
  resolved_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

const createTicketSchema = z.object({
  company_id: z.string().uuid().optional(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.enum(['billing', 'operations', 'technical', 'compliance', 'general']).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

const updateTicketSchema = z.object({
  section: z.literal('tickets'),
  ticketId: z.string().uuid(),
  action: z.enum(['investigating', 'resolve', 'close', 'reopen']),
  note: z.preprocess((value) => typeof value === 'string' ? value : '', z.string().trim().min(5, 'A reason of at least 5 characters is required.').max(5000)),
});

const companyNameMap = async (ids: string[]) => {
  if (!supabaseAdmin || ids.length === 0) return { map: new Map<string, string>(), error: null as string | null };
  const { data, error } = await supabaseAdmin.from('companies').select('id, name').in('id', ids);
  if (error) return { map: new Map<string, string>(), error: error.message };
  return { map: new Map((data as CompanyRow[] ?? []).map((company) => [company.id, company.name])), error: null as string | null };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  if (section === 'disputes') {
    const { data, error } = await supabaseAdmin
      .from('invoice_disputes')
      .select('id, invoice_id, company_id, reason, details, status, resolution_note, created_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return respond(TABLE_MISSING_CODES.has(error.code ?? '') ? 503 : 500, { error: error.message });

    const rows = (data as DisputeRow[] | null) ?? [];
    const names = await companyNameMap(Array.from(new Set(rows.map((row) => row.company_id as string).filter(Boolean))));
    if (names.error) return respond(500, { error: `Failed to resolve dispute companies: ${names.error}` });

    return respond(200, {
      section,
      rows: rows.map((row) => ({
        ...row,
        company_name: names.map.get(row.company_id as string) ?? 'Unknown',
      })),
      summary: {
        total: rows.length,
        open: rows.filter((row) => row.status === 'open').length,
        investigating: rows.filter((row) => row.status === 'investigating').length,
        resolved: rows.filter((row) => row.status === 'resolved').length,
        closed: rows.filter((row) => row.status === 'closed').length,
      },
    });
  }

  if (section === 'complaints') {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('id, company_id, reviewer_id, rating, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return respond(TABLE_MISSING_CODES.has(error.code ?? '') ? 503 : 500, {
        error: TABLE_MISSING_CODES.has(error.code ?? '')
          ? 'Complaints source schema is not available in this environment.'
          : error.message,
      });
    }

    const rows = (data as ReviewRow[] | null) ?? [];
    const names = await companyNameMap(Array.from(new Set(rows.map((row) => row.company_id as string).filter(Boolean))));
    if (names.error) return respond(500, { error: `Failed to resolve complaint companies: ${names.error}` });

    const ratings = rows.map((row) => Number(row.rating)).filter((rating) => !Number.isNaN(rating));
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
      : null;

    return respond(200, {
      section,
      rows: rows.map((row) => ({
        ...row,
        company_name: names.map.get(row.company_id as string) ?? 'Unknown',
      })),
      summary: {
        total: rows.length,
        low_rated: rows.filter((row) => Number(row.rating) <= 2).length,
        average_rating: avgRating,
      },
    });
  }

  if (section === 'tickets') {
    const { data, error } = await supabaseAdmin
      .from('support_tickets')
      .select('id, company_id, raised_by_user_id, subject, description, category, priority, status, assigned_to_user_id, resolution_note, resolved_at, closed_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return respond(TABLE_MISSING_CODES.has(error.code ?? '') ? 503 : 500, {
        error: TABLE_MISSING_CODES.has(error.code ?? '')
          ? 'Support ticket schema is not available in this environment.'
          : error.message,
      });
    }

    const rows = (data as SupportTicketRow[] | null) ?? [];
    const names = await companyNameMap(Array.from(new Set(rows.map((row) => row.company_id as string).filter(Boolean))));
    if (names.error) return respond(500, { error: `Failed to resolve support ticket companies: ${names.error}` });

    const ticketRows = rows.map((row) => ({
      id: row.id,
      company_name: names.map.get(row.company_id as string) ?? 'Unknown',
      subject: row.subject,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      resolution_note: row.resolution_note,
      created_at: row.created_at,
      resolved_at: row.resolved_at,
      closed_at: row.closed_at,
      updated_at: row.updated_at,
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

  return respond(400, { error: 'Invalid section. Use disputes, complaints, or tickets.' });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return respond(400, {
      error: firstIssue?.message ?? 'Validation failed.',
      details: parsed.error.flatten(),
    });
  }

  const { ticketId, action, note } = parsed.data;
  const { data: mutationResult, error: mutationError } = await supabaseAdmin.rpc(
    'owner_update_support_ticket_with_audit',
    {
      p_actor_user_id: owner.id,
      p_ticket_id: ticketId,
      p_action: action,
      p_note: note,
    },
  );

  if (mutationError) {
    if (mutationError.code === 'P0002') return respond(404, { error: mutationError.message });
    if (mutationError.code === '42501') return respond(403, { error: mutationError.message });
    if (mutationError.code === '23514' || mutationError.code === '23502' || mutationError.code === '22P02') {
      return respond(400, { error: mutationError.message });
    }
    return respond(500, { error: mutationError.message });
  }

  const updatedTicket = (Array.isArray(mutationResult) ? mutationResult[0] : mutationResult) as
    | SupportTicketMutationRow
    | null;
  if (!updatedTicket) return respond(500, { error: 'Support ticket update returned no data.' });

  return respond(200, {
    ticket: {
      id: updatedTicket.ticket_id,
      status: updatedTicket.status,
      resolution_note: updatedTicket.resolution_note,
      resolved_at: updatedTicket.resolved_at,
      closed_at: updatedTicket.closed_at,
      updated_at: updatedTicket.updated_at,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

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
