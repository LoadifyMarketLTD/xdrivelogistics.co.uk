import { NextRequest, NextResponse } from 'next/server';
import { resolveActorContext } from '../_lib/actorContext';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

const ALLOWED_ROLES = new Set(['owner', 'broker', 'company_admin', 'company_staff', 'driver']);

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return json(503, { error: 'Service not available — admin client not configured.' });
  }

  const actor = await resolveActorContext(request);
  if ('error' in actor) return json(actor.status, { error: actor.error });
  if (!actor.role || !ALLOWED_ROLES.has(actor.role)) return json(403, { error: 'Forbidden.' });
  if (!actor.companyId) return json(403, { error: 'Forbidden — company context not found.' });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json(400, { error: 'Invalid JSON payload.' });

  const jobId = typeof body.job_id === 'string' ? body.job_id : '';
  if (!jobId) return json(400, { error: 'Missing job_id.' });

  const amountRaw = body.bid_price_gbp ?? body.amount;
  const amount = typeof amountRaw === 'number' ? amountRaw : Number.parseFloat(String(amountRaw ?? ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(400, { error: 'Invalid bid amount.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, exchange_visibility, awarded_carrier_company_id')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) return json(404, { error: 'Job not found.' });
  if (job.company_id === actor.companyId) return json(403, { error: 'Forbidden — cannot bid on your own job.' });
  if (!['exchange', 'direct'].includes((job.exchange_visibility as string | null) ?? '')) {
    return json(400, { error: 'Job is not open for bids.' });
  }
  if (job.awarded_carrier_company_id) return json(409, { error: 'Job already awarded.' });

  const { data: insertedBid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .insert({
      job_id: jobId,
      company_id: actor.companyId,
      bidder_user_id: actor.user.id,
      bidder_driver_id: actor.driverId ?? null,
      bid_price_gbp: amount,
      amount,
      currency: typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim().toUpperCase() : 'GBP',
      message: typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null,
      status: 'submitted',
    })
    .select('id, job_id, company_id, status, bid_price_gbp')
    .single();

  if (bidError) return json(400, { error: `Failed to create bid: ${bidError.message}` });

  return json(201, { success: true, bid: insertedBid });
}
