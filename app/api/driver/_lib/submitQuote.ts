import type { SupabaseClient } from '@supabase/supabase-js';

import { getGlobalSettingNumber } from '../../_lib/platformFlags';
import type { DriverContext } from '../mobile/_lib';
import { resolveDriverBidEligibility } from './bidEligibility';

type AdminClient = SupabaseClient;

export type DriverQuoteInput = {
  jobId: string;
  amount: number;
  message: string;
};

export type DriverQuoteResult =
  | { ok: true; status: 201; bidId: string; jobId: string }
  | { ok: false; status: number; error: string; denialReasons?: string[] };

export async function submitDriverQuote(
  supabaseAdmin: AdminClient,
  driver: DriverContext,
  input: DriverQuoteInput,
): Promise<DriverQuoteResult> {
  const jobId = input.jobId.trim();
  const message = input.message.trim();
  const amount = Number(input.amount);

  if (!jobId) return { ok: false, status: 400, error: 'Job id is required.' };
  if (message.length > 1_000) return { ok: false, status: 400, error: 'Quote message is too long.' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return { ok: false, status: 400, error: 'Enter a valid quote amount.' };
  }

  let eligibilityResult: Awaited<ReturnType<typeof resolveDriverBidEligibility>>;
  try {
    eligibilityResult = await resolveDriverBidEligibility(supabaseAdmin, driver, jobId);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error instanceof Error ? error.message : 'Unable to evaluate bid eligibility.',
    };
  }

  const { eligibility, job } = eligibilityResult;
  if (!job) return { ok: false, status: 404, error: 'Job not found.' };

  if (!eligibility.eligible) {
    if (eligibility.denialReasons.includes('active_bid_exists')) {
      return {
        ok: false,
        status: 409,
        error: 'You already have an active quote for this job.',
        denialReasons: eligibility.denialReasons,
      };
    }
    if (eligibility.denialReasons.includes('job_not_visible_to_driver')) {
      return {
        ok: false,
        status: 403,
        error: 'This load is not visible for your account.',
        denialReasons: eligibility.denialReasons,
      };
    }

    const readinessBlocked = eligibility.operational.blockers.length > 0;
    return {
      ok: false,
      status: readinessBlocked ? 403 : 409,
      error: readinessBlocked
        ? 'Your driver and vehicle must be fully verified and operationally eligible before you can quote.'
        : 'This job is no longer available for quotation.',
      denialReasons: eligibility.denialReasons,
    };
  }

  const [minBidIntervalMinutes, maxBidsPerJob] = await Promise.all([
    getGlobalSettingNumber(supabaseAdmin, 'min_bid_interval_minutes'),
    getGlobalSettingNumber(supabaseAdmin, 'max_bids_per_job'),
  ]);

  if (maxBidsPerJob > 0) {
    const { count: existingBidCount, error: countError } = await supabaseAdmin
      .from('job_bids')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .in('status', ['submitted', 'accepted']);
    if (countError) return { ok: false, status: 500, error: countError.message };
    if ((existingBidCount ?? 0) >= maxBidsPerJob) {
      return { ok: false, status: 429, error: `This job has reached the maximum number of bids (${maxBidsPerJob}).` };
    }
  }

  if (minBidIntervalMinutes > 0) {
    const intervalMs = minBidIntervalMinutes * 60 * 1000;
    const since = new Date(Date.now() - intervalMs).toISOString();
    const { count: recentBidCount, error: recentError } = await supabaseAdmin
      .from('job_bids')
      .select('id', { count: 'exact', head: true })
      .eq('bidder_driver_id', driver.driverId)
      .gte('created_at', since);
    if (recentError) return { ok: false, status: 500, error: recentError.message };
    if ((recentBidCount ?? 0) > 0) {
      return { ok: false, status: 429, error: `Please wait ${minBidIntervalMinutes} minute(s) before submitting another quote.` };
    }
  }

  // Driver-originated bids are always attributable to the named driver. The
  // company id carries commercial supplier context for company_driver; the
  // accepted bidder_driver_id remains the execution identity for allocation.
  const { data: bid, error: insertError } = await supabaseAdmin
    .from('job_bids')
    .insert({
      job_id: jobId,
      company_id: driver.companyId,
      bidder_user_id: driver.userId,
      bidder_driver_id: driver.driverId,
      bid_price_gbp: amount,
      amount,
      currency: 'GBP',
      message: message || null,
      status: 'submitted',
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return { ok: false, status: 409, error: 'You already have an active quote for this job.' };
    }
    return { ok: false, status: 500, error: insertError.message };
  }

  return { ok: true, status: 201, bidId: String(bid.id), jobId };
}
