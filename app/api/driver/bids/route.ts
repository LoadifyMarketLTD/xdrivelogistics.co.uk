import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { operationalError } from '../../_lib/operationalError';
import { isDriverContext, respond } from '../mobile/_lib';
import { requireWebDriver } from '../_lib/webDriver';
import { submitDriverQuote } from '../_lib/submitQuote';

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'Quote submission is temporarily unavailable.',
      context: 'driver.bids.config',
      retryable: true,
    });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as {
    jobId?: unknown;
    amount?: unknown;
    message?: unknown;
  } | null;

  const result = await submitDriverQuote(supabaseAdmin, driver, {
    jobId: typeof body?.jobId === 'string' ? body.jobId : '',
    amount: Number(body?.amount),
    message: typeof body?.message === 'string' ? body.message : '',
  });

  if (!result.ok) {
    return respond(result.status, {
      error: result.error,
      denialReasons: result.denialReasons ?? [],
    });
  }

  return respond(result.status, {
    success: true,
    bidId: result.bidId,
    jobId: result.jobId,
  });
}
