import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { hasBidDecisionRole } from '../../_lib/ownerRoles';
import { BOOKING_PAYMENT_OBLIGATION_TERMS_VERSION } from '../../../../../../lib/legal/paymentObligation';
import { getTransportBuyerRiskSnapshot, transportBuyerRiskBlockedPayload } from '../../../../_lib/transportBuyerRisk';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  // ── 0. Supabase admin must be configured ────────────────────────────────────
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Service not available — admin client not configured.' },
      { status: 503 }
    );
  }

  // ── 1. Authenticate the caller ──────────────────────────────────────────────
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized — no bearer token.' }, { status: 401 });
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized — invalid token.' }, { status: 401 });
  }

  // ── 2. Resolve bid id ───────────────────────────────────────────────────────
  const body = await request.json().catch(() => ({})) as { paymentObligationAcknowledged?: boolean };
  if (body.paymentObligationAcknowledged !== true) {
    return NextResponse.json({ error: 'You must explicitly acknowledge the transport buyer payment obligation before awarding this quote.', code: 'PAYMENT_OBLIGATION_ACK_REQUIRED' }, { status: 409 });
  }

  const { id: bidId } = await params;
  if (!bidId) {
    return NextResponse.json({ error: 'Bad request — missing bid id.' }, { status: 400 });
  }

  // ── 3. Pre-check caller role on owning company ──────────────────────────────
  const { data: bidJob, error: bidJobError } = await supabaseAdmin
    .from('job_bids')
    .select('id, bid_price_gbp, amount, jobs!inner(company_id)')
    .eq('id', bidId)
    .maybeSingle();

  if (bidJobError || !bidJob || !bidJob.jobs) {
    return NextResponse.json({ error: 'Bid not found.' }, { status: 404 });
  }

  const bidJobRelation = Array.isArray(bidJob.jobs) ? bidJob.jobs[0] : bidJob.jobs;
  const jobCompanyId = (bidJobRelation as { company_id?: string } | null)?.company_id;
  if (!jobCompanyId) {
    return NextResponse.json({ error: 'Bid not found.' }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company, companies!inner(status)')
    .eq('user_id', user.id)
    .eq('company_id', jobCompanyId)
    .eq('status', 'active')
    .eq('companies.status', 'active')
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: 'Forbidden — you are not a member of the job-owning company.' },
      { status: 403 }
    );
  }

  if (!hasBidDecisionRole(membership.role_in_company as string | null)) {
    return NextResponse.json(
      { error: 'Forbidden — insufficient role to accept bids.' },
      { status: 403 }
    );
  }

  const projectedAmount = Number((bidJob as { bid_price_gbp?: number | string | null; amount?: number | string | null }).bid_price_gbp ?? (bidJob as { amount?: number | string | null }).amount ?? 0);
  try {
    const risk = await getTransportBuyerRiskSnapshot(supabaseAdmin, jobCompanyId, projectedAmount);
    if (!risk.infrastructureAvailable || !risk.snapshot) return NextResponse.json({ error: 'Transport buyer risk controls are temporarily unavailable.', code: 'TRANSPORT_BUYER_RISK_UNAVAILABLE' }, { status: 503 });
    if (!risk.snapshot.allowed) return NextResponse.json(transportBuyerRiskBlockedPayload(risk.snapshot), { status: 409 });
  } catch {
    return NextResponse.json({ error: 'Transport buyer exposure could not be verified. Please try again.', code: 'TRANSPORT_BUYER_RISK_UNAVAILABLE' }, { status: 503 });
  }

  // ── 4. Atomic accept via database function ───────────────────────────────────
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    'award_job_bid_pending_atomic',
    {
      p_bid_id: bidId,
      p_actor_user_id: user.id,
      p_payment_obligation_acknowledged: true,
      p_payment_obligation_terms_version: BOOKING_PAYMENT_OBLIGATION_TERMS_VERSION,
    }
  );

  if (rpcError) {
    if (String(rpcError.hint ?? '') === 'TRANSPORT_BUYER_RISK_LIMIT') return NextResponse.json({ error: rpcError.message, code: 'TRANSPORT_BUYER_RISK_LIMIT' }, { status: 409 });
    return NextResponse.json(
      { error: `Failed to accept bid: ${rpcError.message}` },
      { status: 500 }
    );
  }

  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (!result?.success) {
    return NextResponse.json(
      { error: result?.error_message ?? 'Accept failed.' },
      { status: result?.http_status ?? 500 }
    );
  }

  return NextResponse.json({
    success: true,
    bidId: result.bid_id,
    jobId: result.job_id,
    bookingOfferId: result.booking_offer_id,
    carrierCompanyId: result.carrier_company_id,
    status: result.status,
  });
}
