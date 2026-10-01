import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const DECISION_ROLES = new Set(['owner', 'admin', 'dispatcher']);
const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const decisionSchema = z.object({
  action: z.enum(['accept', 'reject', 'cancel']),
  note: z.string().trim().max(2000).optional(),
});

async function authenticate(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { response: respond(503, { error: 'Server auth is not configured.' }) } as const;
  const token = getBearerToken(request);
  if (!token) return { response: respond(401, { error: 'Unauthorized.' }) } as const;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { response: respond(401, { error: 'Unauthorized.' }) } as const;
  return { user: data.user } as const;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; amendmentId: string }> },
) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid amendment decision.' });
  const { jobId, amendmentId } = await params;

  const { data: amendment, error: amendmentError } = await supabaseAdmin!
    .from('job_commercial_agreement_amendments')
    .select('id,agreement_id,job_id,version_number,proposed_by_user_id,proposed_by_company_id,counterparty_company_id,status,effective_snapshot_hash')
    .eq('id', amendmentId)
    .eq('job_id', jobId)
    .maybeSingle();
  if (amendmentError) {
    const code = String(amendmentError.code ?? '');
    if (['42P01','PGRST205','42703'].includes(code)) return respond(503, { error: 'Commercial amendment schema is not available.' });
    return respond(500, { error: amendmentError.message });
  }
  if (!amendment) return respond(404, { error: 'Commercial amendment not found.' });
  if (amendment.status !== 'proposed') return respond(409, { error: 'This commercial amendment has already been decided.' });

  const requiredCompanyId = parsed.data.action === 'cancel'
    ? String(amendment.proposed_by_company_id)
    : String(amendment.counterparty_company_id);

  const { data: membership, error: membershipError } = await supabaseAdmin!
    .from('company_memberships')
    .select('company_id,role_in_company')
    .eq('user_id', auth.user.id)
    .eq('company_id', requiredCompanyId)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) return respond(500, { error: membershipError.message });
  let authorisedDecisionMaker = Boolean(
    membership && DECISION_ROLES.has(String(membership.role_in_company ?? '').trim().toLowerCase()),
  );

  if (!authorisedDecisionMaker && parsed.data.action !== 'cancel') {
    const { data: job, error: jobError } = await supabaseAdmin!
      .from('jobs')
      .select('assigned_driver_id,awarded_carrier_company_id,assigned_company_id')
      .eq('id', jobId)
      .maybeSingle();
    if (jobError) return respond(500, { error: jobError.message });
    const executionCompanyId = String(job?.awarded_carrier_company_id ?? job?.assigned_company_id ?? '');
    const assignedDriverId = String(job?.assigned_driver_id ?? '');
    if (assignedDriverId && executionCompanyId === requiredCompanyId) {
      const { data: assignedDriver, error: driverError } = await supabaseAdmin!
        .from('drivers')
        .select('id,user_id')
        .eq('id', assignedDriverId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (driverError) return respond(500, { error: driverError.message });
      authorisedDecisionMaker = Boolean(assignedDriver);
    }
  }

  if (!authorisedDecisionMaker) {
    return respond(403, {
      error: parsed.data.action === 'cancel'
        ? 'Only an authorised member of the proposing company may cancel this amendment.'
        : 'Only the assigned driver or an authorised member of the contractual counterparty may accept or reject this amendment.',
    });
  }

  const nextStatus = parsed.data.action === 'accept' ? 'accepted' : parsed.data.action === 'reject' ? 'rejected' : 'cancelled';
  const now = new Date().toISOString();
  const { data: decided, error } = await supabaseAdmin!
    .from('job_commercial_agreement_amendments')
    .update({
      status: nextStatus,
      decided_by_user_id: auth.user.id,
      decided_by_company_id: requiredCompanyId,
      decision_note: parsed.data.note || null,
      decided_at: now,
    })
    .eq('id', amendment.id)
    .eq('status', 'proposed')
    .select('id,agreement_id,job_id,version_number,proposed_by_company_id,counterparty_company_id,reason,change_summary,base_snapshot_hash,effective_agreed_amount,currency,vat_treatment,vat_rate,vat_amount,effective_gross_amount,payment_terms,payment_due_days,pod_required,effective_job_snapshot,effective_snapshot_hash,status,proposed_at,decided_by_user_id,decided_by_company_id,decision_note,decided_at,created_at')
    .maybeSingle();

  if (error) {
    if (error.code === '23514') return respond(409, { error: error.message });
    return respond(500, { error: error.message });
  }
  if (!decided) return respond(409, { error: 'The amendment changed while the decision was being recorded. Refresh and retry.' });

  await supabaseAdmin!.from('job_tracking_events').insert({
    job_id: jobId,
    event_type: `commercial_amendment_${nextStatus}`,
    event_time: now,
    user_id: auth.user.id,
    created_by: auth.user.id,
    message: `Commercial amendment v${amendment.version_number} ${nextStatus}.`,
    meta: {
      amendment_id: amendment.id,
      version_number: amendment.version_number,
      decision_company_id: requiredCompanyId,
      effective_snapshot_hash: amendment.effective_snapshot_hash,
    },
  }).then(() => undefined, () => undefined);

  await supabaseAdmin!.from('notification_events').insert({
    event_type: `commercial_amendment_${nextStatus}`,
    entity_type: 'job',
    entity_id: jobId,
    company_id: amendment.proposed_by_company_id,
    recipient_user_id: amendment.proposed_by_user_id,
    payload: {
      job_id: jobId,
      amendment_id: amendment.id,
      version_number: amendment.version_number,
      status: nextStatus,
      decision_company_id: requiredCompanyId,
      message: `Job change v${amendment.version_number} was ${nextStatus}. Open XDrive to review the booking history.`,
    },
  }).then(() => undefined, () => undefined);

  return respond(200, { amendment: decided });
}
