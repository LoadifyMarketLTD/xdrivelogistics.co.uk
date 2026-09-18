import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isDriverContext } from '../../../mobile/_lib';
import { requireWebDriver } from '../../../_lib/webDriver';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Quote withdrawal is temporarily unavailable.' });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await context.params;
  const bidId = id?.trim();
  if (!bidId) return json(400, { error: 'Quote id is required.' });

  const { data: bid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, bidder_user_id, bidder_driver_id, status')
    .eq('id', bidId)
    .eq('bidder_user_id', driver.userId)
    .maybeSingle();
  if (bidError) return json(500, { error: 'Quote ownership could not be verified.' });
  if (!bid) return json(404, { error: 'Quote not found.' });
  if (String(bid.bidder_driver_id ?? '') && String(bid.bidder_driver_id) !== driver.driverId) {
    return json(403, { error: 'This quote belongs to a different Driver record.' });
  }

  const status = String(bid.status ?? '').trim().toLowerCase();
  if (status === 'withdrawn') return json(200, { success: true, bidId, status: 'withdrawn', idempotent: true });
  if (status !== 'submitted') {
    return json(409, { error: `Only submitted quotes can be withdrawn. Current status: ${status || 'unknown'}.` });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, awarded_carrier_company_id, assigned_company_id, assigned_driver_id, status, current_status')
    .eq('id', bid.job_id)
    .maybeSingle();
  if (jobError) return json(500, { error: 'The related job could not be verified.' });
  if (!job) return json(409, { error: 'The related job no longer exists.' });
  if (job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id) {
    return json(409, { error: 'This job has already been awarded or allocated, so the quote can no longer be withdrawn.' });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('job_bids')
    .update({ status: 'withdrawn' })
    .eq('id', bidId)
    .eq('bidder_user_id', driver.userId)
    .eq('status', 'submitted')
    .select('id, status')
    .maybeSingle();

  if (updateError) return json(500, { error: 'The quote could not be withdrawn.' });
  if (!updated) return json(409, { error: 'The quote changed before it could be withdrawn. Refresh and try again.' });

  return json(200, { success: true, bidId, status: 'withdrawn', idempotent: false });
}
