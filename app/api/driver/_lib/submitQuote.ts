import type { SupabaseClient } from '@supabase/supabase-js';

import { getGlobalSettingNumber } from '../../_lib/platformFlags';
import type { DriverContext } from '../mobile/_lib';
import { resolveDriverBidEligibility } from './bidEligibility';

type AdminClient = SupabaseClient;

export type DriverQuoteInput = {
  jobId: string;
  amount: number;
  message: string;
  collectWithinMinutes?: number | null;
  additionalExtrasGbp?: number | null;
  vehicleId?: string | null;
};

export type DriverQuoteResult =
  | { ok: true; status: 200 | 201; bidId: string; jobId: string; idempotent: boolean; totalAmount: number }
  | { ok: false; status: number; error: string; denialReasons?: string[] };

type DriverBidRow = {
  id: string;
  status: string | null;
  bidder_driver_id: string | null;
  bidder_user_id: string | null;
  amount: number | null;
  bid_price_gbp: number | null;
  message: string | null;
  collect_within_minutes: number | null;
  additional_extras_gbp: number | null;
  quoted_vehicle_id: string | null;
};

const BID_SELECT = 'id, status, bidder_driver_id, bidder_user_id, amount, bid_price_gbp, message, collect_within_minutes, additional_extras_gbp, quoted_vehicle_id';

function sameQuote(
  bid: DriverBidRow,
  driver: DriverContext,
  totalAmount: number,
  message: string,
  collectWithinMinutes: number | null,
  additionalExtrasGbp: number,
  vehicleId: string | null,
) {
  const sameIdentity = bid.bidder_driver_id === driver.driverId || bid.bidder_user_id === driver.userId;
  const storedAmount = Number(bid.bid_price_gbp ?? bid.amount);
  const storedExtras = Number(bid.additional_extras_gbp ?? 0);
  return sameIdentity
    && Number.isFinite(storedAmount)
    && Math.abs(storedAmount - totalAmount) < 0.000001
    && Math.abs(storedExtras - additionalExtrasGbp) < 0.000001
    && (bid.message ?? '').trim() === message
    && (bid.collect_within_minutes ?? null) === collectWithinMinutes
    && (bid.quoted_vehicle_id ?? null) === vehicleId;
}

async function findPriorBidForDriver(
  supabaseAdmin: AdminClient,
  driver: DriverContext,
  jobId: string,
  totalAmount: number,
  message: string,
  collectWithinMinutes: number | null,
  additionalExtrasGbp: number,
  vehicleId: string | null,
): Promise<{ matchingRetry: DriverBidRow | null; priorBidExists: boolean; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from('job_bids')
    .select(BID_SELECT)
    .eq('job_id', jobId)
    .or(`bidder_driver_id.eq.${driver.driverId},bidder_user_id.eq.${driver.userId}`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return { matchingRetry: null, priorBidExists: false, error: error.message };
  if (!data) return { matchingRetry: null, priorBidExists: false, error: null };

  const bid = data as DriverBidRow;
  const retryableStatus = (bid.status ?? '').toLowerCase() === 'submitted' || (bid.status ?? '').toLowerCase() === 'accepted';
  return {
    matchingRetry: sameQuote(bid, driver, totalAmount, message, collectWithinMinutes, additionalExtrasGbp, vehicleId) && retryableStatus ? bid : null,
    priorBidExists: true,
    error: null,
  };
}

async function findMatchingActiveCompanyBid(
  supabaseAdmin: AdminClient,
  driver: DriverContext,
  jobId: string,
  totalAmount: number,
  message: string,
  collectWithinMinutes: number | null,
  additionalExtrasGbp: number,
  vehicleId: string | null,
): Promise<{ bid: DriverBidRow | null; error: string | null }> {
  if (!driver.companyId) return { bid: null, error: null };
  const { data, error } = await supabaseAdmin
    .from('job_bids')
    .select(BID_SELECT)
    .eq('job_id', jobId)
    .eq('company_id', driver.companyId)
    .in('status', ['submitted', 'accepted'])
    .limit(1)
    .maybeSingle();
  if (error) return { bid: null, error: error.message };
  if (!data) return { bid: null, error: null };
  const bid = data as DriverBidRow;
  return {
    bid: sameQuote(bid, driver, totalAmount, message, collectWithinMinutes, additionalExtrasGbp, vehicleId) ? bid : null,
    error: null,
  };
}

async function validateQuotedVehicle(
  supabaseAdmin: AdminClient,
  driver: DriverContext,
  vehicleId: string | null,
): Promise<{ vehicleId: string | null; error: string | null; status?: number }> {
  if (!vehicleId) return { vehicleId: null, error: null };
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('id, company_id, assigned_driver_id')
    .eq('id', vehicleId)
    .eq('assigned_driver_id', driver.driverId)
    .maybeSingle();
  if (error) return { vehicleId: null, error: error.message, status: 500 };
  if (!data || (driver.companyId && data.company_id !== driver.companyId)) {
    return { vehicleId: null, error: 'The selected vehicle is not assigned to your driver account.', status: 403 };
  }
  return { vehicleId: String(data.id), error: null };
}

export async function submitDriverQuote(
  supabaseAdmin: AdminClient,
  driver: DriverContext,
  input: DriverQuoteInput,
): Promise<DriverQuoteResult> {
  const jobId = input.jobId.trim();
  const message = input.message.trim();
  const baseAmount = Number(input.amount);
  const additionalExtrasGbp = input.additionalExtrasGbp == null ? 0 : Number(input.additionalExtrasGbp);
  const collectWithinMinutes = input.collectWithinMinutes == null ? null : Math.round(Number(input.collectWithinMinutes));
  const requestedVehicleId = typeof input.vehicleId === 'string' && input.vehicleId.trim() ? input.vehicleId.trim() : null;

  if (!jobId) return { ok: false, status: 400, error: 'Job id is required.' };
  if (message.length > 1_000) return { ok: false, status: 400, error: 'Quote message is too long.' };
  if (!Number.isFinite(baseAmount) || baseAmount <= 0 || baseAmount > 1_000_000) {
    return { ok: false, status: 400, error: 'Enter a valid quote amount.' };
  }
  if (!Number.isFinite(additionalExtrasGbp) || additionalExtrasGbp < 0 || additionalExtrasGbp > 1_000_000) {
    return { ok: false, status: 400, error: 'Enter a valid extras amount.' };
  }
  if (collectWithinMinutes !== null && (collectWithinMinutes < 5 || collectWithinMinutes > 240)) {
    return { ok: false, status: 400, error: 'Collection time must be between 5 and 240 minutes.' };
  }
  const totalAmount = Number((baseAmount + additionalExtrasGbp).toFixed(2));
  if (totalAmount > 1_000_000) return { ok: false, status: 400, error: 'Quote total is too high.' };

  const vehicle = await validateQuotedVehicle(supabaseAdmin, driver, requestedVehicleId);
  if (vehicle.error) return { ok: false, status: vehicle.status ?? 500, error: vehicle.error };
  const vehicleId = vehicle.vehicleId;

  const prior = await findPriorBidForDriver(
    supabaseAdmin, driver, jobId, totalAmount, message, collectWithinMinutes, additionalExtrasGbp, vehicleId,
  );
  if (prior.error) return { ok: false, status: 500, error: prior.error };
  if (prior.matchingRetry) {
    return { ok: true, status: 200, bidId: String(prior.matchingRetry.id), jobId, idempotent: true, totalAmount };
  }
  if (prior.priorBidExists) {
    return { ok: false, status: 409, error: 'You have already quoted for this job. A driver can quote only once per job.' };
  }

  let eligibilityResult: Awaited<ReturnType<typeof resolveDriverBidEligibility>>;
  try {
    eligibilityResult = await resolveDriverBidEligibility(supabaseAdmin, driver, jobId);
  } catch (error) {
    return { ok: false, status: 500, error: error instanceof Error ? error.message : 'Unable to evaluate bid eligibility.' };
  }

  const { eligibility, job } = eligibilityResult;
  if (!job) return { ok: false, status: 404, error: 'Job not found.' };
  if (!eligibility.eligible) {
    if (eligibility.denialReasons.includes('active_bid_exists')) {
      const existing = await findMatchingActiveCompanyBid(
        supabaseAdmin, driver, jobId, totalAmount, message, collectWithinMinutes, additionalExtrasGbp, vehicleId,
      );
      if (existing.error) return { ok: false, status: 500, error: existing.error };
      if (existing.bid) {
        return { ok: true, status: 200, bidId: String(existing.bid.id), jobId, idempotent: true, totalAmount };
      }
      return { ok: false, status: 409, error: 'Your company already has an active quote for this job.', denialReasons: eligibility.denialReasons };
    }
    if (eligibility.denialReasons.includes('job_not_visible_to_driver')) {
      return { ok: false, status: 403, error: 'This load is not visible for your account.', denialReasons: eligibility.denialReasons };
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
      .from('job_bids').select('id', { count: 'exact', head: true }).eq('job_id', jobId).in('status', ['submitted', 'accepted']);
    if (countError) return { ok: false, status: 500, error: countError.message };
    if ((existingBidCount ?? 0) >= maxBidsPerJob) return { ok: false, status: 429, error: `This job has reached the maximum number of bids (${maxBidsPerJob}).` };
  }
  if (minBidIntervalMinutes > 0) {
    const since = new Date(Date.now() - minBidIntervalMinutes * 60 * 1000).toISOString();
    const { count: recentBidCount, error: recentError } = await supabaseAdmin
      .from('job_bids').select('id', { count: 'exact', head: true }).eq('bidder_driver_id', driver.driverId).gte('created_at', since);
    if (recentError) return { ok: false, status: 500, error: recentError.message };
    if ((recentBidCount ?? 0) > 0) return { ok: false, status: 429, error: `Please wait ${minBidIntervalMinutes} minute(s) before submitting another quote.` };
  }

  const { data: bid, error: insertError } = await supabaseAdmin
    .from('job_bids')
    .insert({
      job_id: jobId,
      company_id: driver.companyId,
      bidder_user_id: driver.userId,
      bidder_driver_id: driver.driverId,
      bid_price_gbp: totalAmount,
      amount: totalAmount,
      currency: 'GBP',
      message: message || null,
      status: 'submitted',
      collect_within_minutes: collectWithinMinutes,
      additional_extras_gbp: additionalExtrasGbp,
      quoted_vehicle_id: vehicleId,
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const retry = await findPriorBidForDriver(
        supabaseAdmin, driver, jobId, totalAmount, message, collectWithinMinutes, additionalExtrasGbp, vehicleId,
      );
      if (retry.error) return { ok: false, status: 500, error: retry.error };
      if (retry.matchingRetry) {
        return { ok: true, status: 200, bidId: String(retry.matchingRetry.id), jobId, idempotent: true, totalAmount };
      }
      return { ok: false, status: 409, error: 'A quote already exists for this job.' };
    }
    return { ok: false, status: 500, error: insertError.message };
  }

  return { ok: true, status: 201, bidId: String(bid.id), jobId, idempotent: false, totalAmount };
}
