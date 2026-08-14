import { NextRequest } from 'next/server';
import { operationalError } from '../../../_lib/operationalError';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../../mobile/_lib';

const LIST_LIMIT = 150;

type JobRow = Record<string, unknown> & {
  id?: unknown;
  company_id?: unknown;
  created_by?: unknown;
  status?: unknown;
  current_status?: unknown;
  awarded_carrier_company_id?: unknown;
  exchange_posted_at?: unknown;
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

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const bool = (value: unknown) => value === true;
const numberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function safePostcodeArea(value: unknown) {
  const raw = text(value)?.toUpperCase().replace(/\s+/g, ' ');
  if (!raw) return null;
  const uk = raw.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
  if (uk?.[1]) return uk[1];
  const first = raw.split(' ')[0]?.trim();
  if (!first) return null;
  return first.length > 4 ? first.slice(0, 4) : first;
}

function safeAreaLabel(postcode: unknown, countryCode: unknown, fallback: string) {
  const area = safePostcodeArea(postcode);
  const country = text(countryCode)?.toUpperCase();
  if (area && country && !['GB', 'UK'].includes(country)) return `${area}, ${country}`;
  return area ?? country ?? fallback;
}

function visibilityAllows(job: JobRow, driverCompanyId: string | null) {
  const visibility = text(job.exchange_visibility)?.toLowerCase();
  if (!visibility || visibility === 'exchange') return true;
  if (visibility !== 'direct') return false;
  const inviteCompanyId = text(job.direct_invite_company_id);
  return Boolean(driverCompanyId && inviteCompanyId === driverCompanyId);
}

function knownRequirementFlags(job: JobRow) {
  const flags = new Set<string>();
  if (bool(job.collection_tail_lift_required) || bool(job.delivery_tail_lift_required)) flags.add('Tail lift');
  if (bool(job.collection_forklift_available) || bool(job.delivery_forklift_available)) flags.add('Forklift');
  if (bool(job.collection_handball_required) || bool(job.delivery_handball_required)) flags.add('Handball');
  if (bool(job.direct_delivery_required)) flags.add('Direct delivery');

  // `special_requirements` is a mixed legacy field. Never return the raw text
  // before award. Only project recognised quote-safe flags from it.
  const requirements = String(job.special_requirements ?? '').toLowerCase();
  if (requirements.includes('adr required')) flags.add('ADR');
  if (requirements.includes('temperature controlled')) flags.add('Temperature controlled');
  if (requirements.includes('fragile goods')) flags.add('Fragile');
  if (requirements.includes('tail lift required')) flags.add('Tail lift');
  if (requirements.includes('forklift required')) flags.add('Forklift');
  if (requirements.includes('handball required')) flags.add('Handball');

  return [...flags];
}

function publicLoad(
  job: JobRow,
  companyById: Map<string, CompanyRow>,
  profileByUserId: Map<string, ProfileRow>,
  bidByJobId: Map<string, BidRow>,
) {
  const companyId = text(job.company_id) ?? '';
  const company = companyById.get(companyId) ?? null;
  const createdBy = text(job.created_by);
  const postedBy = createdBy ? profileByUserId.get(createdBy)?.full_name ?? null : null;
  const fixedPrice = bool(job.is_fixed_price);
  const bid = bidByJobId.get(String(job.id)) ?? null;

  return {
    id: String(job.id),
    company_id: companyId,
    status: text(job.status) ?? 'posted',
    pickup_area: safeAreaLabel(job.pickup_postcode, job.pickup_country_code, 'Collection area TBC'),
    pickup_postcode_area: safePostcodeArea(job.pickup_postcode),
    pickup_datetime: text(job.pickup_datetime),
    pickup_time_slot: text(job.pickup_time_slot),
    delivery_area: safeAreaLabel(job.delivery_postcode, job.delivery_country_code, 'Delivery area TBC'),
    delivery_postcode_area: safePostcodeArea(job.delivery_postcode),
    delivery_datetime: text(job.delivery_datetime),
    delivery_time_slot: text(job.delivery_time_slot),
    pickup_country_code: text(job.pickup_country_code),
    delivery_country_code: text(job.delivery_country_code),
    vehicle_type: text(job.vehicle_type),
    requested_vehicle_type: text(job.requested_vehicle_type),
    requested_vehicle_label: text(job.requested_vehicle_label),
    cargo_type: text(job.cargo_type),
    requested_cargo_label: text(job.requested_cargo_label),
    weight_kg: numberOrNull(job.weight_kg),
    pallets: numberOrNull(job.pallets),
    length_cm: numberOrNull(job.length_cm),
    width_cm: numberOrNull(job.width_cm),
    height_cm: numberOrNull(job.height_cm),
    cargo_value_gbp: numberOrNull(job.cargo_value_gbp),
    pallet_type: text(job.pallet_type),
    pallet_stackable: typeof job.pallet_stackable === 'boolean' ? job.pallet_stackable : null,
    collection_forklift_available: typeof job.collection_forklift_available === 'boolean' ? job.collection_forklift_available : null,
    collection_tail_lift_required: typeof job.collection_tail_lift_required === 'boolean' ? job.collection_tail_lift_required : null,
    collection_handball_required: typeof job.collection_handball_required === 'boolean' ? job.collection_handball_required : null,
    delivery_forklift_available: typeof job.delivery_forklift_available === 'boolean' ? job.delivery_forklift_available : null,
    delivery_tail_lift_required: typeof job.delivery_tail_lift_required === 'boolean' ? job.delivery_tail_lift_required : null,
    delivery_handball_required: typeof job.delivery_handball_required === 'boolean' ? job.delivery_handball_required : null,
    handling_requirements: knownRequirementFlags(job),
    service_mode: text(job.service_mode),
    direct_delivery_required: bool(job.direct_delivery_required),
    distance_miles: numberOrNull(job.job_distance_miles ?? job.distance_miles),
    is_fixed_price: fixedPrice,
    // A non-fixed `budget_amount` can represent private customer revenue / a broker
    // target. It must not cross the pre-award boundary.
    budget_amount: fixedPrice ? numberOrNull(job.budget_amount) : null,
    currency: text(job.currency) ?? 'GBP',
    exchange_posted_at: text(job.exchange_posted_at),
    hard_copy_pod: text(job.hard_copy_pod),
    pod_required: typeof job.pod_required === 'boolean' ? job.pod_required : null,
    payment_terms: text(job.payment_terms),
    public_quote_notes: null,
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
      amount: numberOrNull(bid.bid_price_gbp ?? bid.amount),
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

  const driver = await requireDriver(request);
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
    : query.eq('status', 'posted').limit(LIST_LIMIT);

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
    const companyId = text(job.company_id);
    if (!companyId) return false;
    if (driver.companyId && companyId === driver.companyId) return false;
    return visibilityAllows(job, driver.companyId);
  });

  if (requestedId && jobs.length === 0) {
    return respond(404, { error: 'This load is not available to your marketplace account.' });
  }

  const jobIds = jobs.map((job) => String(job.id));
  const companyIds = [...new Set(jobs.map((job) => text(job.company_id)).filter((value): value is string => Boolean(value)))];
  const createdByIds = [...new Set(jobs.map((job) => text(job.created_by)).filter((value): value is string => Boolean(value)))];

  const [companiesResult, profilesResult, bidsResult] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from('companies').select('id, name, company_number, phone, company_type, created_at').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    createdByIds.length
      ? supabaseAdmin.from('profiles').select('user_id, full_name').in('user_id', createdByIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? supabaseAdmin.from('job_bids').select('job_id, status, bid_price_gbp, amount, message').eq('bidder_user_id', driver.userId).in('job_id', jobIds).order('created_at', { ascending: false })
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
