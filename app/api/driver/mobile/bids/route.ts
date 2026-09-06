import { NextRequest } from 'next/server';

import { submitDriverQuote } from '../../../driver/_lib/submitQuote';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../_lib/platformFlags';
import { publicAreaLabel } from '../../_lib/marketplacePublic';
import { isDriverContext, requireDriver, respond } from '../_lib';

async function requireMobileDriver(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }
  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  return requireDriver(request);
}

export async function GET(request: NextRequest) {
  const driver = await requireMobileDriver(request);
  if (!isDriverContext(driver)) return driver;

  const scope = new URL(request.url).searchParams.get('scope')?.trim().toLowerCase() ?? '';
  if (scope === 'active-company') {
    const query = supabaseAdmin!
      .from('job_bids')
      .select('job_id')
      .in('status', ['submitted', 'accepted']);
    const { data, error } = driver.companyId
      ? await query.eq('company_id', driver.companyId)
      : await query.or(`bidder_user_id.eq.${driver.userId},bidder_driver_id.eq.${driver.driverId}`);
    if (error) return respond(500, { error: error.message });
    return respond(200, {
      activeJobIds: [...new Set((data ?? []).map((row) => String(row.job_id)).filter(Boolean))],
    });
  }

  const identityFilters = [
    `bidder_user_id.eq.${driver.userId}`,
    `bidder_driver_id.eq.${driver.driverId}`,
  ];

  const { data: bids, error: bidsError } = await supabaseAdmin!
    .from('job_bids')
    .select('id, job_id, company_id, bidder_driver_id, bidder_user_id, amount, bid_price_gbp, base_amount, additional_extras_gbp, collect_within_minutes, currency, status, message, created_at, quote_vehicle_id, quote_vehicle_type, quote_vehicle_equipment, quote_vehicle_max_pallets, quote_vehicle_max_weight_kg')
    .or(identityFilters.join(','))
    .order('created_at', { ascending: false })
    .limit(100);
  if (bidsError) return respond(500, { error: bidsError.message });

  const jobIds = [...new Set((bids ?? []).map((bid) => String(bid.job_id)).filter(Boolean))];
  const { data: jobs, error: jobsError } = jobIds.length
    ? await supabaseAdmin!
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
      const total = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
      const extras = Number(bid.additional_extras_gbp ?? 0);
      const base = bid.base_amount == null ? total - extras : Number(bid.base_amount);
      return {
        id: bid.id,
        jobId: bid.job_id,
        amount: Number.isFinite(total) ? total : null,
        baseAmount: Number.isFinite(base) ? Number(base.toFixed(2)) : null,
        additionalExtrasGbp: Number.isFinite(extras) ? Number(extras.toFixed(2)) : 0,
        collectWithinMinutes: bid.collect_within_minutes ?? null,
        quotedVehicleId: bid.quote_vehicle_id ?? null,
        quotedVehicleType: bid.quote_vehicle_type ?? null,
        quotedVehicleEquipment: Array.isArray(bid.quote_vehicle_equipment) ? bid.quote_vehicle_equipment : [],
        quotedVehicleMaxPallets: bid.quote_vehicle_max_pallets ?? null,
        quotedVehicleMaxWeightKg: bid.quote_vehicle_max_weight_kg ?? null,
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
  const driver = await requireMobileDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as {
    jobId?: unknown;
    amount?: unknown;
    baseAmount?: unknown;
    additionalExtrasGbp?: unknown;
    collectWithinMinutes?: unknown;
    message?: unknown;
  } | null;
  const result = await submitDriverQuote(supabaseAdmin!, driver, {
    jobId: typeof body?.jobId === 'string' ? body.jobId : '',
    amount: Number(body?.amount),
    baseAmount: body?.baseAmount == null ? null : Number(body.baseAmount),
    additionalExtrasGbp: body?.additionalExtrasGbp == null ? 0 : Number(body.additionalExtrasGbp),
    collectWithinMinutes: body?.collectWithinMinutes == null || body.collectWithinMinutes === '' ? null : Number(body.collectWithinMinutes),
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
    idempotent: result.idempotent,
    totalAmount: result.totalAmount,
  });
}

export async function PATCH(request: NextRequest) {
  const driver = await requireMobileDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as { bidId?: unknown; amount?: unknown; message?: unknown } | null;
  const bidId = typeof body?.bidId === 'string' ? body.bidId.trim() : '';
  const amount = Number(body?.amount);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!bidId) return respond(400, { error: 'Quote id is required.' });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return respond(400, { error: 'Enter a valid quote amount.' });
  if (message.length > 1_000) return respond(400, { error: 'Quote message is too long.' });

  const { data: existing, error: loadError } = await supabaseAdmin!
    .from('job_bids')
    .select('id, job_id, status, bidder_user_id, bidder_driver_id')
    .eq('id', bidId)
    .or(`bidder_user_id.eq.${driver.userId},bidder_driver_id.eq.${driver.driverId}`)
    .maybeSingle();
  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Quote not found.' });
  if (String(existing.status).toLowerCase() !== 'submitted') {
    return respond(409, { error: 'This quote can no longer be edited.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin!
    .from('jobs')
    .select('id,status,assigned_company_id,assigned_driver_id,awarded_carrier_company_id')
    .eq('id', existing.job_id)
    .maybeSingle();
  if (jobError) return respond(500, { error: jobError.message });
  if (!job || job.status !== 'posted' || job.assigned_company_id || job.assigned_driver_id || job.awarded_carrier_company_id) {
    return respond(409, { error: 'This job is no longer open for quote changes.' });
  }

  const { data: updated, error: updateError } = await supabaseAdmin!
    .from('job_bids')
    .update({ amount, bid_price_gbp: amount, message: message || null })
    .eq('id', bidId)
    .eq('status', 'submitted')
    .select('id,job_id,amount,bid_price_gbp,status,message')
    .maybeSingle();
  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'This quote changed before the edit could be saved.' });
  return respond(200, { success: true, bid: updated });
}

export async function DELETE(request: NextRequest) {
  const driver = await requireMobileDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as { bidId?: unknown } | null;
  const bidId = typeof body?.bidId === 'string' ? body.bidId.trim() : '';
  if (!bidId) return respond(400, { error: 'Quote id is required.' });

  const { data: existing, error: loadError } = await supabaseAdmin!
    .from('job_bids')
    .select('id,status,bidder_user_id,bidder_driver_id')
    .eq('id', bidId)
    .or(`bidder_user_id.eq.${driver.userId},bidder_driver_id.eq.${driver.driverId}`)
    .maybeSingle();
  if (loadError) return respond(500, { error: loadError.message });
  if (!existing) return respond(404, { error: 'Quote not found.' });
  if (String(existing.status).toLowerCase() !== 'submitted') {
    return respond(409, { error: 'This quote can no longer be withdrawn.' });
  }

  const { data: updated, error: updateError } = await supabaseAdmin!
    .from('job_bids')
    .update({ status: 'withdrawn' })
    .eq('id', bidId)
    .eq('status', 'submitted')
    .select('id,status')
    .maybeSingle();
  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'This quote changed before it could be withdrawn.' });
  return respond(200, { success: true, bid: updated });
}
