import { NextRequest } from 'next/server';

import { resolveDriverBidEligibility } from '../../../driver/_lib/bidEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag, getGlobalSettingNumber } from '../../../_lib/platformFlags';
import { publicAreaLabel } from '../../_lib/marketplacePublic';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const identityFilters = [
    `bidder_user_id.eq.${driver.userId}`,
    `bidder_driver_id.eq.${driver.driverId}`,
    driver.companyId ? `company_id.eq.${driver.companyId}` : null,
  ].filter((value): value is string => Boolean(value));

  const { data: bids, error: bidsError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, company_id, bidder_driver_id, bidder_user_id, amount, bid_price_gbp, currency, status, message, created_at')
    .or(identityFilters.join(','))
    .order('created_at', { ascending: false })
    .limit(100);
  if (bidsError) return respond(500, { error: bidsError.message });

  const jobIds = [...new Set((bids ?? []).map((bid) => String(bid.job_id)).filter(Boolean))];
  const { data: jobs, error: jobsError } = jobIds.length
    ? await supabaseAdmin
        .from('jobs')
        .select('id, assigned_driver_id, pickup_location, pickup_postcode, pickup_country_code, delivery_location, delivery_postcode, delivery_country_code, pickup_datetime, client_name')
        .in('id', jobIds)
    : { data: [], error: null };
  if (jobsError) return respond(500, { error: jobsError.message });

  const jobById = new Map((jobs ?? []).map((job) => [String(job.id), job]));
  return respond(200, {
    bids: (bids ?? []).map((bid) => {
      const job = jobById.get(String(bid.job_id));
      const executionUnlocked = Boolean(job && job.assigned_driver_id === driver.driverId);
      return {
        id: bid.id,
        jobId: bid.job_id,
        amount: bid.bid_price_gbp ?? bid.amount ?? null,
        currency: bid.currency || 'GBP',
        status: bid.status || 'submitted',
        message: bid.message || '',
        createdAt: bid.created_at,
        pickupLocation: job
          ? executionUnlocked
            ? (job.pickup_location || job.pickup_postcode || 'Collection')
            : publicAreaLabel(job.pickup_postcode, job.pickup_country_code, 'Collection area')
          : 'Collection area',
        deliveryLocation: job
          ? executionUnlocked
            ? (job.delivery_location || job.delivery_postcode || 'Delivery')
            : publicAreaLabel(job.delivery_postcode, job.delivery_country_code, 'Delivery area')
          : 'Delivery area',
        pickupDatetime: job?.pickup_datetime ?? null,
        clientName: executionUnlocked ? (job?.client_name || '') : '',
        executionUnlocked,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

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

  const [minBidIntervalMinutes, maxBidsPerJob] = await Promise.all([
    getGlobalSettingNumber(supabaseAdmin, 'min_bid_interval_minutes'),
    getGlobalSettingNumber(supabaseAdmin, 'max_bids_per_job'),
  ]);

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
