import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

// Roles that are allowed to accept bids (job owner side)
const OWNER_ROLES = new Set([
  'owner',
  'admin',
  'dispatcher',
  'company_admin',
  'admin_staff',
  'company',
]);

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

  // ── 2. Resolve the bid ──────────────────────────────────────────────────────
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

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company')
    .eq('user_id', user.id)
    .eq('company_id', job.company_id as string)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: 'Forbidden — you are not a member of the job-owning company.' },
      { status: 403 }
    );
  }

  if (!OWNER_ROLES.has(membership.role_in_company as string)) {
    return NextResponse.json(
      { error: 'Forbidden — insufficient role to accept bids.' },
      { status: 403 }
    );
  }

  // ── 4. Guard: cannot accept own company's bid ────────────────────────────────
  if (bid.company_id === job.company_id) {
    return NextResponse.json(
      { error: 'Forbidden — cannot accept a bid placed by your own company.' },
      { status: 403 }
    );
  }

  // ── 5. Guard: job must be in exchange or direct visibility ───────────────────
  if (!['exchange', 'direct'].includes(job.exchange_visibility as string)) {
    return NextResponse.json(
      { error: 'Bad request — this job is not on the exchange.' },
      { status: 400 }
    );
  }

  // ── 6. Guard: already awarded ────────────────────────────────────────────────
  if (job.awarded_carrier_company_id) {
    return NextResponse.json(
      { error: 'Conflict — this job has already been awarded to a carrier.' },
      { status: 409 }
    );
  }

  // ── 7. Accept the bid ────────────────────────────────────────────────────────
  const { error: acceptError } = await supabaseAdmin
    .from('job_bids')
    .update({ status: 'accepted' })
    .eq('id', bidId);

  if (acceptError) {
    return NextResponse.json(
      { error: `Failed to accept bid: ${acceptError.message}` },
      { status: 500 }
    );
  }

  // ── 8. Reject all competing bids for the same job ────────────────────────────
  const { error: rejectError } = await supabaseAdmin
    .from('job_bids')
    .update({ status: 'rejected' })
    .eq('job_id', bid.job_id as string)
    .neq('id', bidId)
    .in('status', ['submitted', 'accepted']);

  if (rejectError) {
    // Non-fatal: log and continue — the acceptance itself succeeded
    console.error('[bid-accept] Failed to reject competing bids:', rejectError.message);
  }

  // ── 9. Set awarded_carrier_company_id on the job ─────────────────────────────
  const { error: jobUpdateError } = await supabaseAdmin
    .from('jobs')
    .update({ awarded_carrier_company_id: bid.company_id })
    .eq('id', bid.job_id as string);

  if (jobUpdateError) {
    return NextResponse.json(
      { error: `Failed to award job: ${jobUpdateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    bidId,
    jobId: bid.job_id,
    awardedCarrierCompanyId: bid.company_id,
  });
}
