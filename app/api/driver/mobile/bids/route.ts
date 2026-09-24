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

  const scope = new URL(request.url).searchParams.get('scope')?.trim().toLowerCase() ?? '';
  if (scope === 'active-company') {
    // Quote ownership is company/job when the Driver belongs to a carrier company,
    // but full commercial history remains personal. Expose only job ids so Expo
    // can suppress duplicate quoting without leaking colleague amounts/messages.
    const query = supabaseAdmin
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


  if (scope === 'received') {
    if (!driver.companyId) {
      return respond(200, { bids: [], receivedCapability: false });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('role_in_company')
      .eq('user_id', driver.userId)
      .eq('company_id', driver.companyId)
      .eq('status', 'active')
      .in('role_in_company', ['owner', 'admin', 'dispatcher'])
      .maybeSingle();
    if (membershipError) return respond(500, { error: 'Received quote permission could not be verified.' });
    if (!membership) return respond(200, { bids: [], receivedCapability: false });

    const { data: ownedJobs, error: ownedJobsError } = await supabaseAdmin
      .from('jobs')
      .select('id,pickup_location,pickup_postcode,delivery_location,delivery_postcode,pickup_datetime,delivery_datetime,vehicle_type,requested_vehicle_label,cargo_type,requested_cargo_label,weight_kg,no_of_items,status,current_status,currency')
      .eq('company_id', driver.companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (ownedJobsError) return respond(500, { error: ownedJobsError.message });

    const jobIds = (ownedJobs ?? []).map((job) => String(job.id)).filter(Boolean);
    if (jobIds.length === 0) return respond(200, { bids: [], receivedCapability: true });

    const { data: receivedBids, error: receivedBidsError } = await supabaseAdmin
      .from('job_bids')
      .select('id,job_id,company_id,bidder_user_id,bidder_driver_id,amount,bid_price_gbp,currency,status,message,collect_within_minutes,created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false })
      .limit(200);
    if (receivedBidsError) return respond(500, { error: receivedBidsError.message });

    const bidderCompanyIds = [...new Set((receivedBids ?? [])
      .map((bid) => typeof bid.company_id === 'string' ? bid.company_id : '')
      .filter(Boolean))];
    const { data: bidderCompanies, error: bidderCompaniesError } = bidderCompanyIds.length
      ? await supabaseAdmin.from('companies').select('id,name,xd_id').in('id', bidderCompanyIds)
      : { data: [], error: null };
    if (bidderCompaniesError) return respond(500, { error: bidderCompaniesError.message });

    const companyById = new Map((bidderCompanies ?? []).map((company) => [String(company.id), company]));
    const jobById = new Map((ownedJobs ?? []).map((job) => [String(job.id), job]));

    return respond(200, {
      receivedCapability: true,
      bids: (receivedBids ?? []).map((bid) => {
        const job = jobById.get(String(bid.job_id));
        const bidderCompany = bid.company_id ? companyById.get(String(bid.company_id)) : null;
        const amount = Number(bid.bid_price_gbp ?? bid.amount ?? 0);
        return {
          id: bid.id,
          jobId: bid.job_id,
          direction: 'received',
          amount: Number.isFinite(amount) ? amount : null,
          currency: bid.currency || job?.currency || 'GBP',
          status: bid.status || 'submitted',
          message: bid.message || '',
          collectWithinMinutes: bid.collect_within_minutes ?? null,
          createdAt: bid.created_at,
          pickupLocation: job?.pickup_location || job?.pickup_postcode || 'Collection',
          deliveryLocation: job?.delivery_location || job?.delivery_postcode || 'Delivery',
          pickupDatetime: job?.pickup_datetime ?? null,
          deliveryDatetime: job?.delivery_datetime ?? null,
          vehicleLabel: job?.requested_vehicle_label || job?.vehicle_type || null,
          cargoLabel: job?.requested_cargo_label || job?.cargo_type || null,
          weightKg: job?.weight_kg ?? null,
          itemCount: job?.no_of_items ?? null,
          jobStatus: job?.current_status || job?.status || null,
          bidderName: bidderCompany?.name || 'XDrive member',
          bidderMemberId: bidderCompany?.xd_id || null,
          canManage: bid.status === 'submitted',
        };
      }),
    });
  }

  // Driver mobile is the named driver's personal quote history. Company-wide
  // commercial bid history belongs to Fleet/Company workspace permissions and
  // must not be pulled into a driver's feed merely because company_id matches.
  const identityFilters = [
    `bidder_user_id.eq.${driver.userId}`,
    `bidder_driver_id.eq.${driver.driverId}`,
  ];

  const { data: bids, error: bidsError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, company_id, bidder_driver_id, bidder_user_id, amount, bid_price_gbp, base_amount, additional_extras_gbp, collect_within_minutes, currency, status, message, created_at, quote_vehicle_id, quote_vehicle_type, quote_vehicle_equipment, quote_vehicle_max_pallets, quote_vehicle_max_weight_kg')
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
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const mobileAppEnabled = await getFeatureFlag(supabaseAdmin, 'driver_mobile_app');
  if (!mobileAppEnabled) {
    return respond(503, { error: 'The driver mobile app is currently disabled.' });
  }

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => null) as {
    jobId?: unknown;
    amount?: unknown;
    baseAmount?: unknown;
    additionalExtrasGbp?: unknown;
    collectWithinMinutes?: unknown;
    message?: unknown;
  } | null;
  const result = await submitDriverQuote(supabaseAdmin, driver, {
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
