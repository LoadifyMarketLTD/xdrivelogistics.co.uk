import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type CompanyRow = { id: string; name: string };
type DisputeRow = { id: string; invoice_id: string | null; company_id: string | null; reason: string; details: string | null; status: string; resolution_note: string | null; created_at: string; resolved_at: string | null };
type ReviewRow = { id: string; company_id: string | null; reviewer_id: string | null; rating: number | null; comment: string | null; created_at: string };
type SupportTicketDbRow = { id: string; company_id: string | null; category: string; priority: string; status: string; created_at: string };
type SupportTicketDto = { id: string; company_name: string; type: string; severity: string; status: string; created_at: string };
type SupportTicketMutationRow = { ticket_id: string; status: string; resolution_note: string; updated_at: string };

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

const parsePage = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  return { page, limit, offset: (page - 1) * limit };
};

const pagination = (page: number, limit: number, total: number) => ({
  page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1,
});

const companyNameMap = async (ids: string[]) => {
  const map = new Map<string, string>();
  if (!supabaseAdmin || ids.length === 0) return { map, error: null as string | null };
  const { data, error } = await supabaseAdmin.from('companies').select('id, name').in('id', Array.from(new Set(ids)));
  if (error) return { map, error: error.message };
  for (const company of (data ?? []) as CompanyRow[]) map.set(company.id, company.name);
  return { map, error: null as string | null };
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const section = (searchParams.get('section') ?? '').toLowerCase();
  const { page, limit, offset } = parsePage(request);

  if (section === 'disputes') {
    const { data, error, count } = await supabaseAdmin
      .from('invoice_disputes')
      .select('id, invoice_id, company_id, reason, details, status, resolution_note, created_at, resolved_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return respond(500, { error: error.message });
    if (typeof count !== 'number') return respond(500, { error: 'Dispute source returned an incomplete exact count.' });
    const rows = (data as DisputeRow[] | null) ?? [];
    const companyResult = await companyNameMap(rows.map((row) => row.company_id as string).filter(Boolean));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    return respond(200, {
      section,
      rows: rows.map((row) => ({ ...row, company_name: companyResult.map.get(row.company_id as string) ?? 'Unknown company' })),
      summary: { total_records: count, page_records: rows.length },
      pagination: pagination(page, limit, count),
    });
  }

  if (section === 'complaints') {
    const { data, error, count } = await supabaseAdmin
      .from('reviews')
      .select('id, company_id, reviewer_id, rating, comment, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return respond(503, { error: 'Complaints/reviews storage is not available in this environment.', code: 'complaints_source_unavailable' });
      }
      return respond(500, { error: error.message });
    }
    if (typeof count !== 'number') return respond(500, { error: 'Complaints source returned an incomplete exact count.' });
    const rows = (data as ReviewRow[] | null) ?? [];
    const companyResult = await companyNameMap(rows.map((row) => row.company_id as string).filter(Boolean));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    return respond(200, {
      section,
      rows: rows.map((row) => ({ ...row, company_name: companyResult.map.get(row.company_id as string) ?? 'Unknown company' })),
      summary: { total_records: count, page_records: rows.length },
      pagination: pagination(page, limit, count),
    });
  }

  if (section === 'tickets') {
    const { data, error, count } = await supabaseAdmin
      .from('support_tickets')
      .select('id, company_id, category, priority, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return respond(503, { error: 'Support ticket storage is not available in this environment.', code: 'support_ticket_source_unavailable' });
      }
      return respond(500, { error: error.message });
    }
    if (typeof count !== 'number') return respond(500, { error: 'Support ticket source returned an incomplete exact count.' });
    const rows = (data as SupportTicketDbRow[] | null) ?? [];
    const companyResult = await companyNameMap(rows.map((row) => row.company_id as string).filter(Boolean));
    if (companyResult.error) return respond(500, { error: companyResult.error });
    const ticketRows: SupportTicketDto[] = rows.map((row) => ({
      id: row.id,
      company_name: companyResult.map.get(row.company_id as string) ?? 'Unknown company',
      type: row.category,
      severity: row.priority,
      status: row.status,
      created_at: row.created_at,
    }));
    return respond(200, {
      section,
      rows: ticketRows,
      summary: { total_records: count, page_records: ticketRows.length },
      pagination: pagination(page, limit, count),
    });
  }

  return respond(400, { error: 'Invalid section. Use disputes, complaints, or tickets.' });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required. Deploy Preview is read-only.' });

  let body: unknown;
  try { body = await request.json(); } catch { return respond(400, { error: 'Invalid JSON body.' }); }
  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return respond(400, { error: firstIssue?.message ?? 'Validation failed.', details: parsed.error.flatten() });
  }

  const { ticketId, action, note } = parsed.data;
  const { data: mutationResult, error: mutationError } = await supabaseAdmin.rpc('owner_update_support_ticket_with_audit', {
    p_actor_user_id: owner.id,
    p_ticket_id: ticketId,
    p_action: action,
    p_note: note,
  });
  if (mutationError) {
    if (mutationError.code === 'P0002') return respond(404, { error: mutationError.message });
    if (mutationError.code === '42501') return respond(403, { error: mutationError.message });
    if (mutationError.code === '23514' || mutationError.code === '23502' || mutationError.code === '22P02') return respond(400, { error: mutationError.message });
    return respond(500, { error: mutationError.message });
  }

  const updatedTicket = (Array.isArray(mutationResult) ? mutationResult[0] : mutationResult) as SupportTicketMutationRow | null;
  if (!updatedTicket) return respond(500, { error: 'Support ticket update returned no data.' });
  return respond(200, {
    ticket: {
      id: updatedTicket.ticket_id,
      status: updatedTicket.status,
      resolution_note: updatedTicket.resolution_note,
      updated_at: updatedTicket.updated_at,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required. Deploy Preview is read-only.' });

  let body: unknown;
  try { body = await request.json(); } catch { return respond(400, { error: 'Invalid JSON body.' }); }
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Validation failed.', details: parsed.error.flatten() });

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
    .select('id, company_id, category, priority, status, created_at')
    .single();
  if (error) return respond(500, { error: error.message });
  return respond(201, {
    ticket: {
      id: ticket.id,
      company_id: ticket.company_id,
      type: ticket.category,
      severity: ticket.priority,
      status: ticket.status,
      created_at: ticket.created_at,
    },
  });
}
