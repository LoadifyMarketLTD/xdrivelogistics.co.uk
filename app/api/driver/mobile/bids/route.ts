import { NextRequest } from 'next/server';

import { submitDriverQuote } from '../../../driver/_lib/submitQuote';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../_lib/platformFlags';
import { publicAreaLabel } from '../../_lib/marketplacePublic';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) return respond(503, { error: 'The driver mobile app is currently disabled.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  // Driver mobile is the named driver's personal quote history. Company-wide
  // commercial bid history belongs to Fleet/Company workspace permissions and
  // must not be pulled into a driver's feed merely because company_id matches.
  const identityFilters = [
    `bidder_user_id.eq.${driver.userId}`,
    `bidder_driver_id.eq.${driver.driverId}`,
  ];

  const { data: bids, error: bidsError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, company_id, bidder_driver_id, bidder_user_id, amount, bid_price_gbp, currency, status, message, created_at')
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

  const jobById = new Map((jobs ?? []).map((job) => [String(job.id), job]));
  return respond(200, {
    bids: (bids ?? []).map((bid) => {
      const job = jobById.get(String(bid.job_id));
      const executionUnlocked = Boolean(job && job.assigned_driver_id === driver.driverId);
      return {
        id: bid.id,
        jobId: bid.job_id,
        amount: bid.bid_price_gbp ?? bid.amount ?? null,
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
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) {
    return respond(503, { error: 'The driver mobile app is currently disabled.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as { jobId?: unknown; amount?: unknown; message?: unknown } | null;
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
