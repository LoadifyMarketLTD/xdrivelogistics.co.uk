import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isCompanyCapabilityContext, requireCompanyCapability } from '../../../_lib/requireCompanyCapability';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  // ── 0. Supabase admin must be configured ────────────────────────────────────
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: 'Service not available — admin client not configured.' },
      { status: 503 }
    );
  }

  // ── 1. Resolve the bid ──────────────────────────────────────────────────────
  const { id: bidId } = await params;
  if (!bidId) {
    return NextResponse.json({ error: 'Bad request — missing bid id.' }, { status: 400 });
  }

  const { data: bid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, company_id, status')
    .eq('id', bidId)
    .maybeSingle();

  if (bidError || !bid) {
    return NextResponse.json({ error: 'Bid not found.' }, { status: 404 });
  }

  // ── 3. Verify the caller owns the job ───────────────────────────────────────
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, awarded_carrier_company_id, exchange_visibility')
    .eq('id', bid.job_id as string)
    .maybeSingle();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  const decision = await requireCompanyCapability(request, String(job.company_id), 'quotes.award');
  if (!isCompanyCapabilityContext(decision)) return decision;

  // ── 4. Guard: marketplace/direct/private-group bids only ────────────────────
  if (!['exchange', 'direct', 'private_group'].includes((job.exchange_visibility as string | null) ?? '')) {
    return NextResponse.json(
      { error: 'Bad request — this job is not on the exchange.' },
      { status: 400 }
    );
  }

  // ── 5. Guard: only submitted bids can be rejected in this flow ──────────────
  if (bid.status !== 'submitted') {
    return NextResponse.json(
      {
        error:
          'Conflict — only submitted bids can be rejected via this endpoint.',
      },
      { status: 409 }
    );
  }

  // ── 6. Reject the bid ────────────────────────────────────────────────────────
  const { data: rejectedBid, error: rejectError } = await supabaseAdmin
    .from('job_bids')
    .update({ status: 'rejected' })
    .eq('id', bidId)
    .eq('status', 'submitted')
    .select('id')
    .maybeSingle();

  if (rejectError) {
    return NextResponse.json(
      { error: `Failed to reject bid: ${rejectError.message}` },
      { status: 500 }
    );
  }
  if (!rejectedBid) {
    return NextResponse.json(
      { error: 'Conflict — bid is no longer in submitted status.' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    bidId,
    jobId: bid.job_id,
    awardedCarrierCompanyId: job.awarded_carrier_company_id,
  });
}
