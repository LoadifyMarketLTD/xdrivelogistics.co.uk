import { NextRequest } from 'next/server';

import { resolveDriverBidEligibility } from '../_lib/bidEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';
import { isDriverContext, respond } from '../mobile/_lib';
import { requireWebDriver } from '../_lib/webDriver';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Bid eligibility is temporarily unavailable.',
      context: 'driver.bid-eligibility.config',
      retryable: true,
    });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId')?.trim() ?? '';
  if (!jobId) return respond(400, { error: 'jobId query param is required.' });

  try {
    const result = await resolveDriverBidEligibility(supabaseAdmin, driver, jobId);
    const status = result.job ? 200 : 404;
    return respond(status, {
      eligibility: result.eligibility,
      error: result.job ? null : 'Job not found.',
    });
  } catch (error: unknown) {
    return operationalError({
      status: 500,
      message: 'We could not check your eligibility to quote on this load. Please try again.',
      context: `driver.bid-eligibility.job:${jobId}`,
      cause: error,
      retryable: true,
    });
  }
}
