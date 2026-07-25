import { NextRequest } from 'next/server';

import { resolveDriverBidEligibility } from '../../../driver/_lib/bidEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as { jobId?: unknown; amount?: unknown; message?: unknown } | null;
  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
  const requestedAmount = Number(body?.amount);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!jobId) return respond(400, { error: 'Job id is required.' });
  if (driver.driverStatus !== 'active') return respond(403, { error: 'Driver account is not active.' });
  if (driver.appAccess !== true) return respond(403, { error: 'Driver app access has not been approved.' });
  if (driver.canCommercialBid !== true) return respond(403, { error: 'Your account type does not permit commercial bidding.' });
  if (driver.companyId && driver.companyStatus !== 'active') return respond(403, { error: 'Driver company workspace is not active.' });
  if (!driver.companyId && driver.driverType === 'company_driver') {
    return respond(403, { error: 'Company drivers must be linked to an active company workspace before bidding.' });
  }
  if (message.length > 1_000) return respond(400, { error: 'Quote message is too long.' });

  const { eligibility, job, error: eligibilityError } = await resolveDriverBidEligibility(supabaseAdmin, driver, jobId).catch((error: unknown) => ({
    eligibility: null,
    job: null,
    error: error instanceof Error ? error.message : 'Unable to evaluate bid eligibility.',
  }));
  if (!eligibility) {
    return respond(500, { error: eligibilityError || 'Unable to evaluate bid eligibility.' });
  }
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

  const amount = job.is_fixed_price === true
    ? Number(eligibility.job.fixedPriceAmountGbp ?? 0)
    : requestedAmount;
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
