import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';

const DECISION_ROLES = new Set(['owner', 'admin', 'dispatcher']);
const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });
const decisionSchema = z.object({
  extraId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(2000).optional(),
});

type Agreement = {
  id: string;
  job_id: string;
  buyer_company_id: string;
  supplier_company_id: string;
  agreed_amount: number | string;
  contract_version: number;
  contract_snapshot_hash: string;
};

async function authenticate(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { response: respond(503, { error: 'Server auth is not configured.' }) } as const;
  const token = getBearerToken(request);
  if (!token) return { response: respond(401, { error: 'Unauthorized.' }) } as const;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { response: respond(401, { error: 'Unauthorized.' }) } as const;
  return { user: data.user } as const;
}

async function loadAgreement(jobId: string) {
  const { data, error } = await supabaseAdmin!
    .from('job_commercial_agreements_effective')
    .select('id,job_id,buyer_company_id,supplier_company_id,agreed_amount,contract_version,contract_snapshot_hash')
    .eq('job_id', jobId)
    .eq('agreement_status', 'accepted')
    .maybeSingle();
  if (error) return { error } as const;
  return { agreement: data as Agreement | null } as const;
}

async function memberships(userId: string, agreement: Agreement) {
  const { data, error } = await supabaseAdmin!
    .from('company_memberships')
    .select('company_id,role_in_company,status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('company_id', [agreement.buyer_company_id, agreement.supplier_company_id]);
  if (error) return { error } as const;
  return { memberships: data ?? [] } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const { jobId } = await params;
  const loaded = await loadAgreement(jobId);
  if (loaded.error) {
    const code = String(loaded.error.code ?? '');
    if (['42P01','PGRST205','42703'].includes(code)) return respond(503, { error: 'Contractual extras schema is not available.' });
    return respond(500, { error: loaded.error.message });
  }
  if (!loaded.agreement) return respond(404, { error: 'Accepted commercial agreement not found.' });
  const access = await memberships(auth.user.id, loaded.agreement);
  if (access.error) return respond(500, { error: access.error.message });
  if (!access.memberships.length) return respond(403, { error: 'You are not authorised to view execution extras for this booking.' });

  const { data, error } = await supabaseAdmin!
    .from('driver_job_extras')
    .select('id,job_id,driver_id,supplier_company_id,extra_type,description,amount_gbp,minutes,status,reviewed_by,reviewed_at,review_note,decision_company_id,contractual_amendment_id,contractual_snapshot,contractual_snapshot_hash,contractual_snapshot_version,invoice_item_id,created_at,updated_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) {
    const code = String(error.code ?? '');
    if (['42P01','PGRST205','42703'].includes(code)) return respond(503, { error: 'Contractual extras schema is not available.' });
    return respond(500, { error: error.message });
  }

  const buyerMembership = access.memberships.find((row) => String(row.company_id) === loaded.agreement!.buyer_company_id);
  const canDecide = Boolean(buyerMembership && DECISION_ROLES.has(String(buyerMembership.role_in_company ?? '').trim().toLowerCase()));
  return respond(200, {
    agreement: loaded.agreement,
    canDecide,
    extras: data ?? [],
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await authenticate(request);
  if ('response' in auth) return auth.response;
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: parsed.error.issues[0]?.message ?? 'Invalid execution extra decision.' });
  const { jobId } = await params;
  const loaded = await loadAgreement(jobId);
  if (loaded.error) {
    const code = String(loaded.error.code ?? '');
    if (['42P01','PGRST205','42703'].includes(code)) return respond(503, { error: 'Contractual extras schema is not available.' });
    return respond(500, { error: loaded.error.message });
  }
  const agreement = loaded.agreement;
  if (!agreement) return respond(404, { error: 'Accepted commercial agreement not found.' });
  const access = await memberships(auth.user.id, agreement);
  if (access.error) return respond(500, { error: access.error.message });
  const buyerMembership = access.memberships.find((row) => String(row.company_id) === agreement.buyer_company_id);
  if (!buyerMembership || !DECISION_ROLES.has(String(buyerMembership.role_in_company ?? '').trim().toLowerCase())) {
    return respond(403, { error: 'Only an authorised member of the transport buyer may approve or reject execution extras.' });
  }

  const { data: extraRow, error: extraError } = await supabaseAdmin!
    .from('driver_job_extras')
    .select('id,job_id,status')
    .eq('id', parsed.data.extraId)
    .eq('job_id', jobId)
    .maybeSingle();
  if (extraError) return respond(500, { error: extraError.message });
  if (!extraRow) return respond(404, { error: 'Execution extra not found.' });
  if (extraRow.status !== 'submitted') return respond(409, { error: 'Execution extra has already been decided.' });

  const { data, error } = await supabaseAdmin!.rpc('fn_decide_driver_job_extra', {
    p_extra_id: parsed.data.extraId,
    p_decided_by_user_id: auth.user.id,
    p_decided_by_company_id: agreement.buyer_company_id,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  });
  if (error) {
    const code = String(error.code ?? '');
    if (['42P01','PGRST205','42883','42703'].includes(code)) return respond(503, { error: 'Contractual extras decision function is not available.' });
    if (code === '23505') return respond(409, { error: 'Another commercial amendment is already awaiting a decision.' });
    if (['23514','42501','23503'].includes(code)) return respond(409, { error: error.message });
    return respond(500, { error: error.message });
  }

  const decided = Array.isArray(data) ? data[0] : data;
  const now = new Date().toISOString();
  await supabaseAdmin!.from('job_tracking_events').insert({
    job_id: jobId,
    event_type: parsed.data.action === 'approve' ? 'execution_extra_approved' : 'execution_extra_rejected',
    event_time: now,
    user_id: auth.user.id,
    created_by: auth.user.id,
    message: `Execution extra ${parsed.data.action === 'approve' ? 'approved' : 'rejected'}.`,
    meta: {
      extra_id: parsed.data.extraId,
      action: parsed.data.action,
      contractual_amendment_id: decided?.contractual_amendment_id ?? null,
      contractual_snapshot_hash: decided?.contractual_snapshot_hash ?? null,
      contractual_snapshot_version: decided?.contractual_snapshot_version ?? null,
    },
  }).then(() => undefined, () => undefined);

  return respond(200, { extra: decided });
}
