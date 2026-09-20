import { NextRequest } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../_lib/platformFlags';
import { isDriverContext, requireDriver, respond } from '../../_lib';

type BidRow = {
  id: string;
  job_id: string;
  status: string | null;
  bidder_user_id: string | null;
  bidder_driver_id: string | null;
  amount: number | string | null;
  bid_price_gbp: number | string | null;
  base_amount: number | string | null;
  additional_extras_gbp: number | string | null;
  collect_within_minutes: number | null;
  message: string | null;
};

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

function sameNumber(a: unknown, b: number) {
  const n = Number(a);
  return Number.isFinite(n) && Math.abs(n - b) < 0.000001;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  if (!(await getFeatureFlag(supabaseAdmin, 'driver_mobile_app'))) {
    return respond(503, { error: 'The driver mobile app is currently disabled.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const action = String(body.action ?? '').trim().toLowerCase();
  if (!['edit', 'withdraw'].includes(action)) return respond(400, { error: 'Unsupported quote action.' });

  const { data, error } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, status, bidder_user_id, bidder_driver_id, amount, bid_price_gbp, base_amount, additional_extras_gbp, collect_within_minutes, message')
    .eq('id', id)
    .maybeSingle();
  if (error) return respond(500, { error: error.message });
  if (!data) return respond(404, { error: 'Quote not found.' });

  const bid = data as BidRow;
  const owned = bid.bidder_driver_id === driver.driverId || bid.bidder_user_id === driver.userId;
  if (!owned) return respond(403, { error: 'This quote does not belong to the signed-in driver.' });

  const status = String(bid.status ?? '').toLowerCase();
  if (action === 'withdraw') {
    if (status === 'withdrawn') return respond(200, { ok: true, status: 'withdrawn', idempotent: true });
    if (status !== 'submitted') return respond(409, { error: 'Only a submitted quote can be withdrawn.' });
    const { error: withdrawError } = await supabaseAdmin
      .from('job_bids')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'submitted');
    if (withdrawError) return respond(500, { error: withdrawError.message });
    return respond(200, { ok: true, status: 'withdrawn', idempotent: false });
  }

  if (status !== 'submitted') return respond(409, { error: 'Only a submitted quote can be edited.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,status,current_status,assigned_driver_id,awarded_carrier_company_id')
    .eq('id', bid.job_id)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job) return respond(404, { error: 'The quoted job no longer exists.' });
  const jobStatus = String(job.current_status ?? job.status ?? '').toLowerCase();
  if (
    job.assigned_driver_id
    || job.awarded_carrier_company_id
    || !['posted', 'open', 'received', 'quoted', 'draft'].includes(jobStatus)
  ) {
    return respond(409, { error: 'This quote can no longer be edited because the job has progressed.' });
  }

  const total = money(body.amount);
  const extras = body.additionalExtrasGbp == null ? 0 : money(body.additionalExtrasGbp);
  const base = body.baseAmount == null ? total - extras : money(body.baseAmount);
  const collect = body.collectWithinMinutes == null || body.collectWithinMinutes === ''
    ? null
    : Math.round(Number(body.collectWithinMinutes));
  const message = String(body.message ?? '').trim();

  if (!Number.isFinite(total) || total <= 0 || total > 1_000_000) return respond(400, { error: 'Enter a valid quote total.' });
  if (!Number.isFinite(base) || base <= 0 || base > 1_000_000) return respond(400, { error: 'Enter a valid base quote amount.' });
  if (!Number.isFinite(extras) || extras < 0 || extras > 1_000_000) return respond(400, { error: 'Enter a valid extras amount.' });
  if (base + extras > total + 0.01) return respond(400, { error: 'Quote total cannot be lower than the base amount plus extras.' });
  if (collect !== null && (!Number.isFinite(collect) || collect < 5 || collect > 240)) {
    return respond(400, { error: 'Collection time must be between 5 and 240 minutes.' });
  }
  if (message.length > 1_000) return respond(400, { error: 'Quote message is too long.' });

  const idempotent = sameNumber(bid.bid_price_gbp ?? bid.amount, total)
    && sameNumber(bid.base_amount ?? Number(bid.bid_price_gbp ?? bid.amount ?? 0) - Number(bid.additional_extras_gbp ?? 0), base)
    && sameNumber(bid.additional_extras_gbp ?? 0, extras)
    && (bid.collect_within_minutes ?? null) === collect
    && String(bid.message ?? '').trim() === message;
  if (idempotent) return respond(200, { ok: true, bidId: id, jobId: bid.job_id, amount: total, idempotent: true });

  const { error: updateError } = await supabaseAdmin
    .from('job_bids')
    .update({
      bid_price_gbp: total,
      amount: total,
      amount_gbp: total,
      quote_amount: total,
      base_amount: base,
      additional_extras_gbp: extras,
      collect_within_minutes: collect,
      message: message || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'submitted');
  if (updateError) return respond(500, { error: updateError.message });

  return respond(200, { ok: true, bidId: id, jobId: bid.job_id, amount: total, idempotent: false });
}
