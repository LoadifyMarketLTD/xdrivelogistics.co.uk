import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isSuperAdminDeployPreviewReadOnly, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST202', 'PGRST205']);

const mutationSchema = z.object({
  action: z.enum(['assign', 'acknowledge', 'investigate', 'wait', 'resolve', 'close', 'reopen']),
  reason: z.string().trim().max(5000).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const isTableMissing = (error: { code?: string } | null | undefined) =>
  Boolean(error?.code && TABLE_MISSING_CODES.has(error.code));

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const { caseId } = await params;
  const [caseResult, eventsResult] = await Promise.all([
    supabaseAdmin.from('platform_cases').select('*').eq('id', caseId).maybeSingle(),
    supabaseAdmin.from('platform_case_events').select('id, case_id, actor_user_id, event_type, old_status, new_status, reason, metadata, created_at').eq('case_id', caseId).order('created_at', { ascending: false }),
  ]);

  if (isTableMissing(caseResult.error) || isTableMissing(eventsResult.error)) {
    return respond(503, { error: 'Platform Case Centre schema is not applied in this environment.' });
  }
  if (caseResult.error) return respond(500, { error: caseResult.error.message });
  if (!caseResult.data) return respond(404, { error: 'Platform case not found.' });
  if (eventsResult.error) return respond(500, { error: eventsResult.error.message });

  const actorIds = Array.from(new Set((eventsResult.data ?? []).map((event) => event.actor_user_id).filter(Boolean)));
  const { data: profiles, error: profileError } = actorIds.length
    ? await supabaseAdmin.from('profiles').select('user_id, full_name').in('user_id', actorIds)
    : { data: [], error: null };
  if (profileError) return respond(500, { error: profileError.message });
  const actorNameById = new Map((profiles ?? []).map((profile) => [String(profile.user_id), String(profile.full_name ?? 'Platform Owner')]));

  return respond(200, {
    readOnly: isSuperAdminDeployPreviewReadOnly(),
    case: caseResult.data,
    events: (eventsResult.data ?? []).map((event) => ({
      ...event,
      actor_label: actorNameById.get(String(event.actor_user_id)) ?? 'Platform Owner',
    })),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const owner = await verifyPlatformOwner(request);
  if (!owner) return respond(403, { error: 'Forbidden: active Platform Owner required.' });

  const body = await request.json().catch(() => null);
  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid case action.', details: parsed.error.flatten() });
  }

  const { caseId } = await params;
  const value = parsed.data;
  const { data, error } = await supabaseAdmin.rpc('owner_mutate_platform_case', {
    p_actor_user_id: owner.id,
    p_case_id: caseId,
    p_action: value.action,
    p_reason: value.reason ?? null,
    p_assigned_to_user_id: value.assignedToUserId ?? null,
    p_metadata: value.metadata ?? {},
  });

  if (error) {
    if (isTableMissing(error)) return respond(503, { error: 'Platform Case Centre schema is not applied in this environment.' });
    const code = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : error.code === '23514' ? 409 : 500;
    return respond(code, { error: error.message });
  }

  return respond(200, { case: Array.isArray(data) ? data[0] ?? null : data });
}
