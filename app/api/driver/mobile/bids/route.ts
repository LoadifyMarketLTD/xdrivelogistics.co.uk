import { NextRequest } from 'next/server';

import { submitDriverQuote } from '../../../driver/_lib/submitQuote';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../_lib/platformFlags';
import { publicAreaLabel } from '../../_lib/marketplacePublic';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const identityFilters = [`bidder_user_id.eq.${driver.userId}`, `bidder_driver_id.eq.${driver.driverId}`];
  const { data: bids, error: bidsError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, company_id, bidder_driver_id, bidder_user_id, amount, bid_price_gbp, currency, status, message, created_at, collect_within_minutes, additional_extras_gbp, quoted_vehicle_id')
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

  const vehicleIds = [...new Set((bids ?? []).map((bid) => String(bid.quoted_vehicle_id ?? '')).filter(Boolean))];
  const { data: vehicles, error: vehiclesError } = vehicleIds.length
    ? await supabaseAdmin.from('vehicles').select('id,type,make,model,reg_plate').in('id', vehicleIds)
    : { data: [], error: null };
  if (vehiclesError) return respond(500, { error: vehiclesError.message });

  const jobById = new Map((jobs ?? []).map((job) => [String(job.id), job]));
  const vehicleById = new Map((vehicles ?? []).map((vehicle) => [String(vehicle.id), vehicle]));
  return respond(200, {
    bids: (bids ?? []).map((bid) => {
      const job = jobById.get(String(bid.job_id));
      const executionUnlocked = Boolean(job && job.assigned_driver_id === driver.driverId);
      const vehicle = bid.quoted_vehicle_id ? vehicleById.get(String(bid.quoted_vehicle_id)) : null;
      const total = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
      const extras = Number(bid.additional_extras_gbp ?? 0);
      return {
        id: bid.id,
        jobId: bid.job_id,
        amount: Number.isFinite(total) ? total : null,
        baseAmount: Number.isFinite(total - extras) ? Number((total - extras).toFixed(2)) : null,
        additionalExtrasGbp: Number.isFinite(extras) ? extras : 0,
        collectWithinMinutes: bid.collect_within_minutes ?? null,
        quotedVehicleId: bid.quoted_vehicle_id ?? null,
        quotedVehicleLabel: vehicle ? [vehicle.make, vehicle.model, vehicle.type, vehicle.reg_plate].filter(Boolean).join(' · ') : null,
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
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as {
    jobId?: unknown;
    amount?: unknown;
    message?: unknown;
    collectWithinMinutes?: unknown;
    additionalExtrasGbp?: unknown;
    vehicleId?: unknown;
  } | null;
  const result = await submitDriverQuote(supabaseAdmin, driver, {
    jobId: typeof body?.jobId === 'string' ? body.jobId : '',
    amount: Number(body?.amount),
    message: typeof body?.message === 'string' ? body.message : '',
    collectWithinMinutes: body?.collectWithinMinutes == null ? null : Number(body.collectWithinMinutes),
    additionalExtrasGbp: body?.additionalExtrasGbp == null ? 0 : Number(body.additionalExtrasGbp),
    vehicleId: typeof body?.vehicleId === 'string' ? body.vehicleId : null,
  });
  if (!result.ok) return respond(result.status, { error: result.error, denialReasons: result.denialReasons ?? [] });
  return respond(result.status, {
    success: true,
    bidId: result.bidId,
    jobId: result.jobId,
    idempotent: result.idempotent,
    totalAmount: result.totalAmount,
  });
}
