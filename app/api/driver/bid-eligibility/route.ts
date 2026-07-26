import { NextRequest } from 'next/server';

import { resolveDriverBidEligibility } from '../_lib/bidEligibility';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../mobile/_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId')?.trim() ?? '';
  if (!jobId) return respond(400, { error: 'jobId query param is required.' });

  const result = await resolveDriverBidEligibility(supabaseAdmin, driver, jobId).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unable to evaluate driver bid eligibility.';
    return { error: message } as const;
  });

  if ('error' in result) {
    return respond(500, { error: result.error });
  }

  const status = result.job ? 200 : 404;
  return respond(status, {
    eligibility: result.eligibility,
    error: result.job ? null : 'Job not found.',
  });
}
