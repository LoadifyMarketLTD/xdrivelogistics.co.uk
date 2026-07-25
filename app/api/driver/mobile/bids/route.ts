import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

const activeBidStatuses = ['submitted', 'accepted'];

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as { jobId?: unknown; amount?: unknown; message?: unknown } | null;
  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
  const amount = Number(body?.amount);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!jobId) return respond(400, { error: 'Job id is required.' });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return respond(400, { error: 'Enter a valid quote amount.' });
  }
  if (message.length > 1_000) return respond(400, { error: 'Quote message is too long.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,company_id,status,exchange_visibility,direct_invite_company_id,assigned_company_id,assigned_driver_id,awarded_carrier_company_id')
    .eq('id', jobId)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'Job not found.' });

  const visibleToDriver = job.exchange_visibility === 'exchange'
    || (job.exchange_visibility === 'direct' && job.direct_invite_company_id === driver.companyId);
  const available = job.status === 'posted'
    && visibleToDriver
    && job.company_id !== driver.companyId
    && !job.assigned_company_id
    && !job.assigned_driver_id
    && !job.awarded_carrier_company_id;
  if (!available) return respond(409, { error: 'This job is no longer available for quotation.' });

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('job_bids')
    .select('id')
    .eq('job_id', jobId)
    .eq('company_id', driver.companyId)
    .in('status', activeBidStatuses)
    .limit(1);
  if (existingError) return respond(500, { error: existingError.message });
  if ((existing ?? []).length > 0) return respond(409, { error: 'You already have an active quote for this job.' });

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
    if (insertError.code === '23505') return respond(409, { error: 'You already have an active quote for this job.' });
    return respond(500, { error: insertError.message });
  }

  return respond(201, { success: true, bidId: bid.id, jobId });
}
