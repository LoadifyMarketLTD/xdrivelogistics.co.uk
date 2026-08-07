import { NextRequest } from 'next/server';

import { resolveDriverBidEligibility } from '../../../driver/_lib/bidEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag, getGlobalSettingNumber } from '../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  // PR-0.2: Gate entire driver mobile bidding behind the driver_mobile_app feature flag.
  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) {
    return respond(503, { error: 'The driver mobile app is currently disabled.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as { jobId?: unknown; amount?: unknown; message?: unknown } | null;
  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
  const requestedAmount = Number(body?.amount);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!jobId) return respond(400, { error: 'Job id is required.' });
  if (driver.canCommercialBid !== true) return respond(403, { error: 'Your account type does not permit commercial bidding.' });
  if (driver.companyId && driver.companyStatus !== 'active') return respond(403, { error: 'Driver company workspace is not active.' });
  if (message.length > 1_000) return respond(400, { error: 'Quote message is too long.' });

  // PR-0.3: Enforce configurable bid submission limits from global settings.
  const [minBidIntervalMinutes, maxBidsPerJob] = await Promise.all([
    getGlobalSettingNumber(supabaseAdmin, 'min_bid_interval_minutes'),
    getGlobalSettingNumber(supabaseAdmin, 'max_bids_per_job'),
  ]);;

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

  // PR-0.3: Enforce max bids per job (configurable via global setting).
  if (maxBidsPerJob > 0) {
    const { count: existingBidCount } = await supabaseAdmin
      .from('job_bids')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .in('status', ['submitted', 'pending', 'accepted']);
    if ((existingBidCount ?? 0) >= maxBidsPerJob) {
      return respond(429, { error: `This job has reached the maximum number of bids (${maxBidsPerJob}).` });
    }
  }

  // PR-0.3: Enforce minimum interval between bids from the same driver (configurable).
  if (minBidIntervalMinutes > 0) {
    const intervalMs = minBidIntervalMinutes * 60 * 1000;
    const since = new Date(Date.now() - intervalMs).toISOString();
    const { count: recentBidCount } = await supabaseAdmin
      .from('job_bids')
      .select('id', { count: 'exact', head: true })
      .eq('bidder_driver_id', driver.driverId)
      .gte('created_at', since);
    if ((recentBidCount ?? 0) > 0) {
      return respond(429, { error: `Please wait ${minBidIntervalMinutes} minute(s) before submitting another quote.` });
    }
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
      status: 'submitted',
    })
    .select('id')
    .single();
  if (insertError) {
    if (insertError.code === '23505') return respond(409, { error: 'You already have an active quote for this job.' });
    return respond(500, { error: insertError.message });
  }

  return respond(201, { success: true, bidId: bid.id, jobId });
}
