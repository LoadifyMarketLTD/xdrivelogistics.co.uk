import { NextRequest } from 'next/server';
import { operationalError } from '../../../_lib/operationalError';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import {
  marketplaceNumber,
  marketplaceText,
  proposedPriceAmount,
  publicAreaLabel,
  publicOutcode,
  publicQuoteNotes,
  quoteSafeRequirementFlags,
} from '../../_lib/marketplacePublic';
import { isDriverContext, respond } from '../../mobile/_lib';
import { requireWebDriver } from '../../_lib/webDriver';

const LIST_LIMIT = 150;

type JobRow = Record<string, unknown> & {
  id?: unknown;
  company_id?: unknown;
  created_by?: unknown;
  status?: unknown;
  current_status?: unknown;
  awarded_carrier_company_id?: unknown;
  exchange_posted_at?: unknown;
  exchange_expires_at?: unknown;
  exchange_visibility?: unknown;
  direct_invite_company_id?: unknown;
};

type CompanyRow = {
  id: string;
  name: string | null;
  company_number: string | null;
  phone: string | null;
  company_type: string | null;
  created_at: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
};

type BidRow = {
  job_id: string;
  status: string | null;
  bid_price_gbp: number | string | null;
  amount: number | string | null;
  message: string | null;
};

function visibilityAllows(job: JobRow, driverCompanyId: string | null) {
  const visibility = marketplaceText(job.exchange_visibility)?.toLowerCase();
  if (visibility === 'exchange') return true;
  if (visibility !== 'direct') return false;
  const inviteCompanyId = marketplaceText(job.direct_invite_company_id);
  return Boolean(driverCompanyId && inviteCompanyId === driverCompanyId);
}

function exchangePostActive(job: JobRow, nowMs = Date.now()) {
  const expiresAt = marketplaceText(job.exchange_expires_at);
  if (!expiresAt) return true;
  const expires = new Date(expiresAt).getTime();
  return Number.isFinite(expires) && expires > nowMs;
}

function publicLoad(
  job: JobRow,
  companyById: Map<string, CompanyRow>,
  profileByUserId: Map<string, ProfileRow>,
  bidByJobId: Map<string, BidRow>,
) {
  const companyId = marketplaceText(job.company_id) ?? '';
  const company = companyById.get(companyId) ?? null;
  const createdBy = marketplaceText(job.created_by);
  const postedBy = createdBy ? profileByUserId.get(createdBy)?.full_name ?? null : null;
  const bid = bidByJobId.get(String(job.id)) ?? null;

  return {
    id: String(job.id),
    company_id: companyId,
    status: marketplaceText(job.status) ?? 'posted',
    pickup_area: publicAreaLabel(job.pickup_postcode, job.pickup_country_code, 'Collection area TBC'),
    pickup_postcode_area: publicOutcode(job.pickup_postcode),
    pickup_datetime: marketplaceText(job.pickup_datetime),
    pickup_time_slot: marketplaceText(job.pickup_time_slot),
    delivery_area: publicAreaLabel(job.delivery_postcode, job.delivery_country_code, 'Delivery area TBC'),
    delivery_postcode_area: publicOutcode(job.delivery_postcode),
    delivery_datetime: marketplaceText(job.delivery_datetime),
    delivery_time_slot: marketplaceText(job.delivery_time_slot),
    pickup_country_code: marketplaceText(job.pickup_country_code),
    delivery_country_code: marketplaceText(job.delivery_country_code),
    vehicle_type: marketplaceText(job.vehicle_type),
    requested_vehicle_type: marketplaceText(job.requested_vehicle_type),
    requested_vehicle_label: marketplaceText(job.requested_vehicle_label),
    cargo_type: marketplaceText(job.cargo_type),
    requested_cargo_label: marketplaceText(job.requested_cargo_label),
    weight_kg: marketplaceNumber(job.weight_kg),
    pallets: marketplaceNumber(job.pallets),
    length_cm: marketplaceNumber(job.length_cm),
    width_cm: marketplaceNumber(job.width_cm),
    height_cm: marketplaceNumber(job.height_cm),
    cargo_value_gbp: marketplaceNumber(job.cargo_value_gbp),
    pallet_type: marketplaceText(job.pallet_type),
    pallet_stackable: typeof job.pallet_stackable === 'boolean' ? job.pallet_stackable : null,
    collection_forklift_available: typeof job.collection_forklift_available === 'boolean' ? job.collection_forklift_available : null,
    collection_tail_lift_required: typeof job.collection_tail_lift_required === 'boolean' ? job.collection_tail_lift_required : null,
    collection_handball_required: typeof job.collection_handball_required === 'boolean' ? job.collection_handball_required : null,
    delivery_forklift_available: typeof job.delivery_forklift_available === 'boolean' ? job.delivery_forklift_available : null,
    delivery_tail_lift_required: typeof job.delivery_tail_lift_required === 'boolean' ? job.delivery_tail_lift_required : null,
    delivery_handball_required: typeof job.delivery_handball_required === 'boolean' ? job.delivery_handball_required : null,
    handling_requirements: quoteSafeRequirementFlags(job),
    service_mode: marketplaceText(job.service_mode),
    direct_delivery_required: job.direct_delivery_required === true,
    distance_miles: marketplaceNumber(job.job_distance_miles ?? job.distance_miles),
    is_fixed_price: job.is_fixed_price === true,
    budget_amount: proposedPriceAmount(job.budget_amount),
    currency: marketplaceText(job.currency) ?? 'GBP',
    exchange_posted_at: marketplaceText(job.exchange_posted_at),
    hard_copy_pod: marketplaceText(job.hard_copy_pod),
    pod_required: typeof job.pod_required === 'boolean' ? job.pod_required : null,
    payment_terms: marketplaceText(job.payment_terms),
    public_quote_notes: publicQuoteNotes(job.load_details),
    member: {
      companyId,
      name: company?.name ?? 'Marketplace member',
      memberId: company?.company_number ?? null,
      phone: company?.phone ?? null,
      memberType: company?.company_type ?? null,
      memberSince: company?.created_at ?? null,
      postedBy,
    },
    myBid: bid ? {
      status: bid.status,
      amount: marketplaceNumber(bid.bid_price_gbp ?? bid.amount),
      message: bid.message,
    } : null,
  };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return operationalError({
      status: 503,
      message: 'The driver marketplace is temporarily unavailable.',
      context: 'driver.marketplace.loads.config',
      retryable: true,
    });
  }

  const driver = await requireWebDriver(request);
  if (!isDriverContext(driver)) return driver;

  const requestedId = new URL(request.url).searchParams.get('id')?.trim() || null;
  let query = supabaseAdmin
    .from('jobs')
    .select('*')
    .not('exchange_posted_at', 'is', null)
    .is('awarded_carrier_company_id', null)
    .order('exchange_posted_at', { ascending: false });

  query = requestedId
    ? query.eq('id', requestedId).in('status', ['posted', 'quoted']).limit(1)
    : query.in('status', ['posted', 'quoted']).limit(LIST_LIMIT);

  const { data: rawJobs, error: jobsError } = await query;
  if (jobsError) {
    return operationalError({
      status: 500,
      message: 'The live load board could not be loaded. Please retry.',
      context: requestedId ? `driver.marketplace.load:${requestedId}` : 'driver.marketplace.loads.list',
      cause: jobsError,
      retryable: true,
    });
  }

  const jobs = ((rawJobs ?? []) as JobRow[]).filter((job) => {
    const companyId = marketplaceText(job.company_id);
    if (!companyId) return false;
    if (driver.companyId && companyId === driver.companyId) return false;
    if (!exchangePostActive(job)) return false;
    return visibilityAllows(job, driver.companyId);
  });

  if (requestedId && jobs.length === 0) {
    return respond(404, { error: 'This load is not available to your marketplace account.' });
  }

  const jobIds = jobs.map((job) => String(job.id));
  const companyIds = [...new Set(
    jobs
      .map((job) => marketplaceText(job.company_id))
      .filter((value): value is string => Boolean(value)),
  )];
  const createdByIds = [...new Set(
    jobs
      .map((job) => marketplaceText(job.created_by))
      .filter((value): value is string => Boolean(value)),
  )];

  const bidQuery = jobIds.length
    ? supabaseAdmin
        .from('job_bids')
        .select('job_id, status, bid_price_gbp, amount, message')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
    : null;

  const [companiesResult, profilesResult, bidsResult] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from('companies').select('id, name, company_number, phone, company_type, created_at').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    createdByIds.length
      ? supabaseAdmin.from('profiles').select('user_id, full_name').in('user_id', createdByIds)
      : Promise.resolve({ data: [], error: null }),
    bidQuery
      ? driver.companyId
        ? bidQuery.eq('company_id', driver.companyId)
        : bidQuery.eq('bidder_user_id', driver.userId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (companiesResult.error) {
    return operationalError({
      status: 500,
      message: 'Marketplace member identity could not be loaded. Please retry.',
      context: 'driver.marketplace.loads.member-identity',
      cause: companiesResult.error,
      retryable: true,
    });
  }

  const companyById = new Map(
    ((companiesResult.data ?? []) as CompanyRow[]).map((row) => [row.id, row]),
  );
  const profileByUserId = new Map(
    profilesResult.error
      ? []
      : ((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.user_id, row]),
  );
  const bidByJobId = new Map<string, BidRow>();
  if (!bidsResult.error) {
    for (const bid of (bidsResult.data ?? []) as BidRow[]) {
      if (!bidByJobId.has(bid.job_id)) bidByJobId.set(bid.job_id, bid);
    }
  }

  const loads = jobs.map((job) => publicLoad(job, companyById, profileByUserId, bidByJobId));
  return respond(200, requestedId ? { load: loads[0] } : { loads });
}
