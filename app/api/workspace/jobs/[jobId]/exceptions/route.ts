import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ jobId: string }> };
const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const MANAGER_ROLES = new Set(['owner', 'admin', 'dispatcher', 'fleet_manager']);
const createSchema = z.object({
  companyId: z.string().uuid(),
  category: z.enum(['delay','breakdown','collection_failed','delivery_failed','damage','access_issue','customer_unavailable','vehicle_issue','other']),
  severity: z.enum(['info','warning','critical']).default('warning'),
  description: z.string().trim().min(5).max(2000),
  occurredAt: z.string().datetime({ offset: true }).optional().nullable(),
});
const updateSchema = z.object({
  companyId: z.string().uuid(),
  exceptionId: z.string().uuid(),
  action: z.enum(['monitor', 'resolve', 'reopen']),
  resolutionNote: z.string().trim().max(2000).optional().nullable(),
});

async function authenticate(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { response: respond(503, { error: 'Operational exception service is unavailable.' }) } as const;
  }
  const token = getBearerToken(request);
  if (!token) return { response: respond(401, { error: 'Unauthorized.' }) } as const;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { response: respond(401, { error: 'Invalid session.' }) } as const;
  return { user: data.user } as const;
}

async function resolveContext(userId: string, jobId: string, companyId: string, requireManage = false) {
  const { data: job, error: jobError } = await supabaseAdmin!
    .from('jobs')
    .select('id,company_id,assigned_company_id,awarded_carrier_company_id,current_status,status')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return { response: respond(500, { error: 'Booking access could not be verified.' }) } as const;
  if (!job) return { response: respond(404, { error: 'Booking not found.' }) } as const;

  const participants = new Set([
    String(job.company_id ?? ''),
    String(job.assigned_company_id ?? ''),
    String(job.awarded_carrier_company_id ?? ''),
  ].filter(Boolean));
  if (!participants.has(companyId)) {
    return { response: respond(403, { error: 'This company is not a participant in the booking.' }) } as const;
  }

  const { data: membership, error: membershipError } = await supabaseAdmin!
    .from('company_memberships')
    .select('role_in_company')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return { response: respond(503, { error: 'Company authority could not be verified.' }) } as const;
  if (!membership) return { response: respond(403, { error: 'Active company membership required.' }) } as const;
  const role = String(membership.role_in_company ?? '').trim().toLowerCase();
  if (requireManage && !MANAGER_ROLES.has(role)) {
    return { response: respond(403, { error: 'Owner, admin, dispatcher or fleet manager access is required to manage operational exceptions.' }) } as const;
  }
  return { job, role } as const;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const { jobId } = await params;
  const companyId = request.nextUrl.searchParams.get('companyId')?.trim() ?? '';
  if (!z.string().uuid().safeParse(companyId).success) return respond(400, { error: 'Valid companyId is required.' });
  const context = await resolveContext(auth.user.id, jobId, companyId);
  if ('response' in context) return context.response;

  const { data, error } = await supabaseAdmin!
    .from('job_operational_exceptions')
    .select('id,job_id,company_id,category,severity,status,description,occurred_at,resolution_note,resolved_at,created_at,updated_at')
    .eq('job_id', jobId)
    .order('occurred_at', { ascending: false });
  if (error) return respond(500, { error: 'Operational exceptions could not be loaded.' });

  return respond(200, { exceptions: data ?? [], canManage: MANAGER_ROLES.has(context.role) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid operational exception.' });
  const { jobId } = await params;
  const context = await resolveContext(auth.user.id, jobId, parsed.data.companyId, true);
  if ('response' in context) return context.response;

  const now = new Date().toISOString();
  const { data: exception, error } = await supabaseAdmin!
    .from('job_operational_exceptions')
    .insert({
      job_id: jobId,
      company_id: parsed.data.companyId,
      reported_by: auth.user.id,
      category: parsed.data.category,
      severity: parsed.data.severity,
      status: 'open',
      description: parsed.data.description,
      occurred_at: parsed.data.occurredAt ?? now,
      updated_at: now,
    })
    .select('id,job_id,company_id,category,severity,status,description,occurred_at,resolution_note,resolved_at,created_at,updated_at')
    .single();
  if (error) return respond(500, { error: 'Operational exception could not be recorded.' });

  const { error: auditError } = await supabaseAdmin!.from('job_tracking_events').insert({
    job_id: jobId,
    event_type: 'note',
    event_time: now,
    user_id: auth.user.id,
    created_by: auth.user.id,
    message: 'Operational exception reported: ' + parsed.data.category.replaceAll('_', ' ') + '.',
    meta: {
      kind: 'operational_exception',
      exception_id: exception.id,
      category: parsed.data.category,
      severity: parsed.data.severity,
      reporting_company_id: parsed.data.companyId,
    },
  });

  return respond(201, {
    exception,
    auditWarning: auditError ? 'Exception recorded, but its tracking audit event could not be written.' : null,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid operational exception update.' });
  const { jobId } = await params;
  const context = await resolveContext(auth.user.id, jobId, parsed.data.companyId, true);
  if ('response' in context) return context.response;

  const { data: existing, error: existingError } = await supabaseAdmin!
    .from('job_operational_exceptions')
    .select('id,status')
    .eq('id', parsed.data.exceptionId)
    .eq('job_id', jobId)
    .maybeSingle();
  if (existingError) return respond(500, { error: 'Operational exception could not be verified.' });
  if (!existing) return respond(404, { error: 'Operational exception not found.' });

  const nextStatus = parsed.data.action === 'resolve' ? 'resolved'
    : parsed.data.action === 'monitor' ? 'monitoring'
      : 'open';
  if (existing.status === nextStatus) return respond(409, { error: 'Exception is already ' + nextStatus + '.' });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status: nextStatus, updated_at: now };
  if (parsed.data.action === 'resolve') {
    update.resolution_note = parsed.data.resolutionNote?.trim() || 'Resolved by operator.';
    update.resolved_by = auth.user.id;
    update.resolved_at = now;
  } else if (parsed.data.action === 'reopen') {
    update.resolution_note = null;
    update.resolved_by = null;
    update.resolved_at = null;
  } else if (parsed.data.resolutionNote?.trim()) {
    update.resolution_note = parsed.data.resolutionNote.trim();
  }

  const { data: exception, error } = await supabaseAdmin!
    .from('job_operational_exceptions')
    .update(update)
    .eq('id', parsed.data.exceptionId)
    .eq('job_id', jobId)
    .select('id,job_id,company_id,category,severity,status,description,occurred_at,resolution_note,resolved_at,created_at,updated_at')
    .single();
  if (error) return respond(500, { error: 'Operational exception could not be updated.' });

  const { error: auditError } = await supabaseAdmin!.from('job_tracking_events').insert({
    job_id: jobId,
    event_type: 'note',
    event_time: now,
    user_id: auth.user.id,
    created_by: auth.user.id,
    message: 'Operational exception ' + (parsed.data.action === 'resolve' ? 'resolved' : parsed.data.action === 'monitor' ? 'moved to monitoring' : 'reopened') + '.',
    meta: {
      kind: 'operational_exception',
      exception_id: parsed.data.exceptionId,
      action: parsed.data.action,
      company_id: parsed.data.companyId,
    },
  });

  return respond(200, {
    exception,
    auditWarning: auditError ? 'Exception updated, but its tracking audit event could not be written.' : null,
  });
}
