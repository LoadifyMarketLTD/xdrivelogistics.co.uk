import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205']);

const createSchema = z.object({
  source: z.string().trim().min(2).max(80),
  caseType: z.string().trim().min(2).max(80),
  severity: z.enum(['P0', 'P1', 'P2', 'P3']),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  entityType: z.string().trim().min(2).max(80),
  entityId: z.string().trim().min(1).max(200),
  entityLabel: z.string().trim().min(1).max(240),
  companyId: z.string().uuid().nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  dedupeKey: z.string().trim().min(2).max(240).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const isTableMissing = (error: { code?: string } | null | undefined) =>
  Boolean(error?.code && TABLE_MISSING_CODES.has(error.code));

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50') || 50));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status')?.trim().toLowerCase() ?? '';
  const severity = searchParams.get('severity')?.trim().toUpperCase() ?? '';
  const source = searchParams.get('source')?.trim() ?? '';
  const assignee = searchParams.get('assignee')?.trim().toLowerCase() ?? '';

  let query = supabaseAdmin
    .from('platform_cases')
    .select(
      'id, reference, source, case_type, severity, status, title, description, entity_type, entity_id, entity_label, company_id, assigned_to_user_id, detected_at, created_at, updated_at',
      { count: 'exact' },
    )
    .order('updated_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (severity && severity !== 'ALL') query = query.eq('severity', severity);
  if (source && source !== 'all') query = query.eq('source', source);
  if (assignee === 'me') query = query.eq('assigned_to_user_id', owner.id);
  if (assignee === 'unassigned') query = query.is('assigned_to_user_id', null);

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (isTableMissing(error)) {
    return respond(200, {
      available: false,
      rows: [],
      pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: page > 1 },
      note: 'Platform Case Centre schema is not applied in this environment.',
    });
  }
  if (error) return respond(500, { error: error.message });

  const rows = data ?? [];
  const assigneeIds = Array.from(new Set(rows.map((row) => row.assigned_to_user_id).filter((value): value is string => Boolean(value))));
  const { data: profiles, error: profileError } = assigneeIds.length
    ? await supabaseAdmin.from('profiles').select('user_id, full_name').in('user_id', assigneeIds)
    : { data: [], error: null };
  if (profileError) return respond(500, { error: profileError.message });

  const nameByUserId = new Map((profiles ?? []).map((profile) => [String(profile.user_id), String(profile.full_name ?? 'Platform Owner')]));
  const total = count ?? rows.length;

  return respond(200, {
    available: true,
    rows: rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      source: row.source,
      case_type: row.case_type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_label: row.entity_label,
      company_id: row.company_id,
      assigned_to_user_id: row.assigned_to_user_id,
      assigned_to_label: row.assigned_to_user_id ? nameByUserId.get(row.assigned_to_user_id) ?? 'Platform operator' : null,
      detected_at: row.detected_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid platform case payload.', details: parsed.error.flatten() });
  }

  const value = parsed.data;
  const { data, error } = await supabaseAdmin.rpc('owner_create_platform_case', {
    p_actor_user_id: owner.id,
    p_source: value.source,
    p_case_type: value.caseType,
    p_severity: value.severity,
    p_title: value.title,
    p_description: value.description ?? null,
    p_entity_type: value.entityType,
    p_entity_id: value.entityId,
    p_entity_label: value.entityLabel,
    p_company_id: value.companyId ?? null,
    p_assigned_to_user_id: value.assignedToUserId ?? null,
    p_dedupe_key: value.dedupeKey ?? null,
    p_metadata: value.metadata ?? {},
  });

  if (error) {
    if (isTableMissing(error)) return respond(503, { error: 'Platform Case Centre schema is not applied in this environment.' });
    const code = error.code === '42501' ? 403 : error.code === '23514' ? 400 : 500;
    return respond(code, { error: error.message });
  }

  return respond(201, { case: Array.isArray(data) ? data[0] ?? null : data });
}
