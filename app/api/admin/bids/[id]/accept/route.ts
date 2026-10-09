import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyCapabilityContext, requireCompanyCapability } from '../../../_lib/requireCompanyCapability';
import { BOOKING_PAYMENT_OBLIGATION_TERMS_VERSION } from '../../../../../../lib/legal/paymentObligation';
import { getTransportBuyerRiskSnapshot, logTransportBuyerRiskBlockedEvent, transportBuyerRiskBlockedPayload } from '../../../../_lib/transportBuyerRisk';
import { getStripeCommercialReadiness, stripeCommercialReadinessPayload } from '../../../../_lib/stripeCommercialReadiness';
import { getCommercialLegalReadiness, commercialLegalReadinessPayload } from '../../../../_lib/commercialLegalReadiness';
import { areCompaniesBlocked } from '../../../../_lib/companyBlocks';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  // ── 0. Supabase admin must be configured ────────────────────────────────────
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Service not available — admin client not configured.' },
      { status: 503 }
    );
  }

  // ── 1. Resolve bid id ───────────────────────────────────────────────────────
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
    .select('id, company_id, bid_price_gbp, amount, jobs!inner(company_id)')
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

  const decision = await requireCompanyCapability(request, jobCompanyId, 'quotes.award');
  if (!isCompanyCapabilityContext(decision)) return decision;

  const carrierCompanyId = (bidJob as { company_id?: string | null }).company_id;
  if (!carrierCompanyId) {
    return NextResponse.json(
      { error: 'The selected carrier company could not be resolved for this quote.' },
      { status: 409 }
    );
  }

  const blockState = await areCompaniesBlocked(supabaseAdmin, jobCompanyId, carrierCompanyId);
  if (blockState.error) {
    return NextResponse.json(
      { error: 'Member block status could not be verified. Please retry.' },
      { status: 503 }
    );
  }
  if (blockState.blocked) {
    return NextResponse.json(
      { error: 'This quote cannot be awarded because commercial interaction between these companies is blocked.' },
      { status: 403 }
    );
  }

  let payerLegalReadiness;
  let carrierLegalReadiness;
  try {
    [payerLegalReadiness, carrierLegalReadiness] = await Promise.all([
      getCommercialLegalReadiness(supabaseAdmin, jobCompanyId),
      getCommercialLegalReadiness(supabaseAdmin, carrierCompanyId),
    ]);
  } catch {
    return NextResponse.json(
      { error: 'Current legal acceptance could not be verified. Please try again.' },
      { status: 503 }
    );
  }
  if (!payerLegalReadiness.infrastructureAvailable || !carrierLegalReadiness.infrastructureAvailable) {
    return NextResponse.json(
      { error: 'Legal agreement evidence is temporarily unavailable.' },
      { status: 503 }
    );
  }
  if (!payerLegalReadiness.ready) {
    return NextResponse.json(
      commercialLegalReadinessPayload('Review and re-accept the current XDrive legal agreements before awarding transport work.', payerLegalReadiness, '/admin/settings/legal-agreements'),
      { status: 409 }
    );
  }
  if (!carrierLegalReadiness.ready) {
    return NextResponse.json(
      commercialLegalReadinessPayload('This carrier must re-accept the current XDrive legal agreements before it can be awarded transport work.', carrierLegalReadiness),
      { status: 409 }
    );
  }

  let payerStripeReadiness;
  let carrierStripeReadiness;
  try {
    [payerStripeReadiness, carrierStripeReadiness] = await Promise.all([
      getStripeCommercialReadiness(supabaseAdmin, jobCompanyId),
      getStripeCommercialReadiness(supabaseAdmin, carrierCompanyId),
    ]);
  } catch {
    return NextResponse.json(
      { error: 'Stripe commercial readiness could not be verified. Please try again.' },
      { status: 503 }
    );
  }
  if (!payerStripeReadiness.infrastructureAvailable || !carrierStripeReadiness.infrastructureAvailable) {
    return NextResponse.json(
      { error: 'Stripe commercial readiness is temporarily unavailable.' },
      { status: 503 }
    );
  }
  if (!payerStripeReadiness.ready) {
    return NextResponse.json(
      stripeCommercialReadinessPayload('Complete and activate your company Stripe account before awarding transport work.'),
      { status: 409 }
    );
  }
  if (!carrierStripeReadiness.ready) {
    return NextResponse.json(
      stripeCommercialReadinessPayload('This carrier cannot be awarded the job until its Stripe account is fully activated.'),
      { status: 409 }
    );
  }

  const projectedAmount = Number((bidJob as { bid_price_gbp?: number | string | null; amount?: number | string | null }).bid_price_gbp ?? (bidJob as { amount?: number | string | null }).amount ?? 0);
  try {
    const risk = await getTransportBuyerRiskSnapshot(supabaseAdmin, jobCompanyId, projectedAmount);
    if (!risk.infrastructureAvailable || !risk.snapshot) return NextResponse.json({ error: 'Transport buyer risk controls are temporarily unavailable.', code: 'TRANSPORT_BUYER_RISK_UNAVAILABLE' }, { status: 503 });
    if (!risk.snapshot.allowed) {
      await logTransportBuyerRiskBlockedEvent(supabaseAdmin, risk.snapshot, 'award_blocked', decision.userId, { operation: 'admin_award', bid_id: bidId });
      return NextResponse.json(transportBuyerRiskBlockedPayload(risk.snapshot), { status: 409 });
    }
  } catch {
    return NextResponse.json({ error: 'Transport buyer exposure could not be verified. Please try again.', code: 'TRANSPORT_BUYER_RISK_UNAVAILABLE' }, { status: 503 });
  }

  // ── 4. Atomic accept via database function ───────────────────────────────────
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    'award_job_bid_pending_atomic',
    {
      p_bid_id: bidId,
      p_actor_user_id: decision.userId,
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
