import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveDriverOperationalEligibility,
  type DriverOperationalEligibility,
} from './operationalEligibility';

const activeBidStatuses = ['submitted', 'accepted'];

type AdminClient = SupabaseClient;

export type DriverBidContext = {
  userId: string;
  driverId: string;
  companyId: string | null;
  driverStatus: string;
  appAccess: boolean;
  canCommercialBid: boolean;
  companyStatus: string | null;
};

type BidEligibilityJob = {
  id: string;
  company_id: string | null;
  status: string | null;
  exchange_visibility: string | null;
  exchange_expires_at: string | null;
  direct_invite_company_id: string | null;
  assigned_company_id: string | null;
  assigned_driver_id: string | null;
  awarded_carrier_company_id: string | null;
  is_fixed_price: boolean | null;
  budget_amount: number | string | null;
};

export type DriverBidEligibility = {
  jobId: string;
  eligible: boolean;
  operational: DriverOperationalEligibility;
  driver: {
    status: string;
    active: boolean;
    appAccess: boolean;
    canCommercialBid: boolean;
    companyId: string | null;
    companyActive: boolean;
    companyStatus: string | null;
    canonicalVehicleId: string | null;
  };
  job: {
    found: boolean;
    status: string | null;
    exchangeVisibility: string | null;
    visibleToDriver: boolean;
    ownCompanyJob: boolean;
    assigned: boolean;
    awarded: boolean;
    expired: boolean;
    hasProposedPrice: boolean;
    proposedPriceGbp: number | null;
  };
  hasActiveBid: boolean;
  denialReasons: string[];
};

const toAmount = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const exchangeExpired = (value: string | null | undefined, nowMs = Date.now()) => {
  if (!value) return false;
  const expires = new Date(value).getTime();
  return !Number.isFinite(expires) || expires <= nowMs;
};

export async function resolveDriverBidEligibility(
  supabaseAdmin: AdminClient,
  driver: DriverBidContext,
  jobId: string
): Promise<{ eligibility: DriverBidEligibility; job: BidEligibilityJob | null }> {
  const [operational, jobResult] = await Promise.all([
    resolveDriverOperationalEligibility(supabaseAdmin, driver.driverId),
    supabaseAdmin
      .from('jobs')
      .select('id,company_id,status,exchange_visibility,exchange_expires_at,direct_invite_company_id,assigned_company_id,assigned_driver_id,awarded_carrier_company_id,is_fixed_price,budget_amount')
      .eq('id', jobId)
      .maybeSingle(),
  ]);

  if (jobResult.error) {
    throw new Error(jobResult.error.message);
  }

  const job = (jobResult.data ?? null) as BidEligibilityJob | null;
  const driverActive = operational.checks.accountActive;
  const companyActive = operational.checks.companyActive;

  const visibleToDriver = !!job && (
    job.exchange_visibility === 'exchange'
    || (Boolean(driver.companyId) && job.exchange_visibility === 'direct' && job.direct_invite_company_id === driver.companyId)
  );

  const ownCompanyJob = !!job && Boolean(driver.companyId) && job.company_id === driver.companyId;
  const assigned = !!job && (Boolean(job.assigned_company_id) || Boolean(job.assigned_driver_id));
  const awarded = !!job && Boolean(job.awarded_carrier_company_id);
  const expired = !!job && exchangeExpired(job.exchange_expires_at);

  let hasActiveBid = false;
  if (job) {
    const query = supabaseAdmin
      .from('job_bids')
      .select('id')
      .eq('job_id', jobId)
      .in('status', activeBidStatuses)
      .limit(1);

    // One active quote per carrier company/job. A second Driver belonging to the
    // same carrier must see the same gate instead of reaching the DB uniqueness
    // boundary only at insert time. Independent Drivers remain driver-scoped.
    const { data: existing, error: existingError } = driver.companyId
      ? await query.eq('company_id', driver.companyId)
      : await query.eq('bidder_driver_id', driver.driverId);

    if (existingError) {
      throw new Error(existingError.message);
    }

    hasActiveBid = (existing ?? []).length > 0;
  }

  const denialReasons = [...operational.blockers];
  if (!job) denialReasons.push('job_not_found');
  if (job && !['posted', 'quoted'].includes(String(job.status ?? '').trim().toLowerCase())) denialReasons.push('job_not_posted');
  if (job && !visibleToDriver) denialReasons.push('job_not_visible_to_driver');
  if (expired) denialReasons.push('job_exchange_expired');
  if (ownCompanyJob) denialReasons.push('own_company_job');
  if (assigned) denialReasons.push('job_already_assigned');
  if (awarded) denialReasons.push('job_already_awarded');
  if (hasActiveBid) denialReasons.push('active_bid_exists');

  const proposedPriceGbp = toAmount(job?.budget_amount);

  return {
    job,
    eligibility: {
      jobId,
      eligible: denialReasons.length === 0,
      operational,
      driver: {
        status: driver.driverStatus,
        active: driverActive,
        appAccess: operational.checks.appAccess,
        canCommercialBid: operational.checks.commercialBidEnabled,
        companyId: operational.companyId,
        companyActive,
        companyStatus: driver.companyStatus,
        canonicalVehicleId: operational.canonicalVehicleId,
      },
      job: {
        found: Boolean(job),
        status: job?.status ?? null,
        exchangeVisibility: job?.exchange_visibility ?? null,
        visibleToDriver,
        ownCompanyJob,
        assigned,
        awarded,
        expired,
        hasProposedPrice: proposedPriceGbp !== null,
        proposedPriceGbp,
      },
      hasActiveBid,
      denialReasons: [...new Set(denialReasons)],
    },
  };
}
