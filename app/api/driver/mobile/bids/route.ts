import { NextRequest } from 'next/server';

import { resolveDriverBidEligibility } from '../../../driver/_lib/bidEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';
import { IDEMPOTENCY_CONFLICT_ERROR, isDeterministicBidReplay, type IncomingBidReplayIntent, type StoredBidReplayRow } from './idempotency';

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as {
    jobId?: unknown;
    amount?: unknown;
    message?: unknown;
    idempotencyKey?: unknown;
    bidKey?: unknown;
  } | null;
  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
  const requestedAmount = Number(body?.amount);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const bidKey = typeof body?.bidKey === 'string'
    ? body.bidKey.trim()
    : typeof body?.idempotencyKey === 'string'
      ? body.idempotencyKey.trim()
      : '';

  if (!jobId) return respond(400, { error: 'Job id is required.' });
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(bidKey)) return respond(400, { error: 'A valid bid idempotency key is required.' });
  if (driver.canCommercialBid !== true) return respond(403, { error: 'Your account type does not permit commercial bidding.' });
  if (driver.companyId && driver.companyStatus !== 'active') return respond(403, { error: 'Driver company workspace is not active.' });
  // NOTE: Bidding access is gated exclusively by can_commercial_bid (canonical architecture).
  // Do NOT add a block here based on driver_type alone — company_driver is a valid bidding entity.
  // See supabase/migrations/20260726060000_canonical_driver_type_architecture.sql
  if (message.length > 1_000) return respond(400, { error: 'Quote message is too long.' });

  const incomingReplayIntent: IncomingBidReplayIntent = {
    jobId,
    bidderUserId: driver.userId,
    bidderDriverId: driver.driverId,
    amount: requestedAmount,
    currency: 'GBP',
    message,
  };

  const { data: existingByKey, error: existingByKeyError } = await supabaseAdmin
    .from('job_bids')
    .select('id,job_id,bidder_user_id,bidder_driver_id,amount,bid_price_gbp,currency,message')
    .eq('job_id', jobId)
    .eq('bidder_user_id', driver.userId)
    .eq('mobile_submission_idempotency_key', bidKey)
    .maybeSingle();
  if (existingByKeyError) return respond(500, { error: existingByKeyError.message });
  if (existingByKey) {
    if (isDeterministicBidReplay(existingByKey as StoredBidReplayRow, incomingReplayIntent)) {
      return respond(200, { success: true, bidId: existingByKey.id, jobId: existingByKey.job_id });
    }
    return respond(409, { error: IDEMPOTENCY_CONFLICT_ERROR });
  }

  let eligibilityResult: Awaited<ReturnType<typeof resolveDriverBidEligibility>>;
  try {
    eligibilityResult = await resolveDriverBidEligibility(supabaseAdmin, driver, jobId);
  } catch (error) {
    return respond(500, { error: error instanceof Error ? error.message : 'Unable to evaluate bid eligibility.' });
  }
  const { eligibility, job } = eligibilityResult;
  if (!job) return respond(404, { error: 'Job not found.' });

  if (!eligibility.eligible) {
    if (eligibility.denialReasons.includes('active_bid_exists')) {
      return respond(409, { error: 'You already have an active quote for this job.' });
    }
    if (eligibility.denialReasons.includes('job_not_visible_to_driver')) {
      return respond(403, { error: 'This load is not visible for your account.' });
    }
    return respond(409, { error: 'This job is no longer available for quotation.' });
  }

  const amount = requestedAmount;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return respond(400, { error: 'Enter a valid quote amount.' });
  }

  const { data: bid, error: insertError } = await supabaseAdmin
    .from('job_bids')
    .insert({
      job_id: jobId,
      company_id: driver.companyId ?? null,
      bidder_user_id: driver.userId,
      bidder_driver_id: driver.driverId,
      bid_price_gbp: amount,
      amount,
      currency: 'GBP',
      message: message || null,
      mobile_submission_idempotency_key: bidKey,
      status: 'submitted',
    })
    .select('id')
    .single();
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: conflictBid, error: conflictError } = await supabaseAdmin
        .from('job_bids')
        .select('id,job_id,bidder_user_id,bidder_driver_id,amount,bid_price_gbp,currency,message')
        .eq('job_id', jobId)
        .eq('bidder_user_id', driver.userId)
        .eq('mobile_submission_idempotency_key', bidKey)
        .maybeSingle();
      if (conflictError) return respond(500, { error: conflictError.message });
      if (conflictBid) {
        if (isDeterministicBidReplay(conflictBid as StoredBidReplayRow, incomingReplayIntent)) {
          return respond(200, { success: true, bidId: conflictBid.id, jobId: conflictBid.job_id });
        }
        return respond(409, { error: IDEMPOTENCY_CONFLICT_ERROR });
      }
    }
    if (insertError.code === '23505') return respond(409, { error: 'You already have an active quote for this job.' });
    return respond(500, { error: insertError.message });
  }

  return respond(201, { success: true, bidId: bid.id, jobId });
}
