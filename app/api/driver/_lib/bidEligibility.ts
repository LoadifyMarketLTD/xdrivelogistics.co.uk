import type { SupabaseClient } from '@supabase/supabase-js';

const activeBidStatuses = ['submitted', 'accepted', 'awarded', 'approved'];

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
  driver: {
    status: string;
    active: boolean;
    appAccess: boolean;
    canCommercialBid: boolean;
    companyId: string | null;
    companyActive: boolean;
    companyStatus: string | null;
  };
  job: {
    found: boolean;
    status: string | null;
    exchangeVisibility: string | null;
    visibleToDriver: boolean;
    ownCompanyJob: boolean;
    assigned: boolean;
    awarded: boolean;
    isFixedPrice: boolean;
    fixedPriceAmountGbp: number | null;
  };
  hasActiveBid: boolean;
  denialReasons: string[];
};

const toAmount = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export async function resolveDriverBidEligibility(
  supabaseAdmin: AdminClient,
  driver: DriverBidContext,
  jobId: string
): Promise<{ eligibility: DriverBidEligibility; job: BidEligibilityJob | null }> {
  const { data: jobData, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id,company_id,status,exchange_visibility,direct_invite_company_id,assigned_company_id,assigned_driver_id,awarded_carrier_company_id,is_fixed_price,budget_amount')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) {
    throw new Error(jobError.message);
  }

  const job = (jobData ?? null) as BidEligibilityJob | null;
  const driverActive = driver.driverStatus === 'active';
  const companyActive = driver.companyId ? driver.companyStatus === 'active' : true;

  const visibleToDriver = !!job && (
    job.exchange_visibility === 'exchange'
    || (Boolean(driver.companyId) && job.exchange_visibility === 'direct' && job.direct_invite_company_id === driver.companyId)
  );

  const ownCompanyJob = !!job && Boolean(driver.companyId) && job.company_id === driver.companyId;
  const assigned = !!job && (Boolean(job.assigned_company_id) || Boolean(job.assigned_driver_id));
  const awarded = !!job && Boolean(job.awarded_carrier_company_id);

  let hasActiveBid = false;
  if (job) {
    const query = supabaseAdmin
      .from('job_bids')
      .select('id')
      .eq('job_id', jobId)
      .in('status', activeBidStatuses)
      .limit(1);

    const { data: existing, error: existingError } = driver.companyId
      ? await query.eq('company_id', driver.companyId)
      : await query.is('company_id', null).eq('bidder_user_id', driver.userId);

    if (existingError) {
      throw new Error(existingError.message);
    }

    hasActiveBid = (existing ?? []).length > 0;
  }

  const denialReasons: string[] = [];
  if (!driverActive) denialReasons.push('driver_inactive');
  if (!driver.appAccess) denialReasons.push('driver_app_access_disabled');
  if (!driver.canCommercialBid) denialReasons.push('commercial_bidding_not_permitted');
  if (!companyActive) denialReasons.push('company_inactive');
  if (!job) denialReasons.push('job_not_found');
  if (job && job.status !== 'posted') denialReasons.push('job_not_posted');
  if (job && !visibleToDriver) denialReasons.push('job_not_visible_to_driver');
  if (ownCompanyJob) denialReasons.push('own_company_job');
  if (assigned) denialReasons.push('job_already_assigned');
  if (awarded) denialReasons.push('job_already_awarded');
  if (hasActiveBid) denialReasons.push('active_bid_exists');

  const fixedPriceAmountGbp = job?.is_fixed_price === true ? toAmount(job.budget_amount) : null;

  return {
    job,
    eligibility: {
      jobId,
      eligible: denialReasons.length === 0,
      driver: {
        status: driver.driverStatus,
        active: driverActive,
        appAccess: driver.appAccess,
        canCommercialBid: driver.canCommercialBid,
        companyId: driver.companyId,
        companyActive,
        companyStatus: driver.companyStatus,
      },
      job: {
        found: Boolean(job),
        status: job?.status ?? null,
        exchangeVisibility: job?.exchange_visibility ?? null,
        visibleToDriver,
        ownCompanyJob,
        assigned,
        awarded,
        isFixedPrice: job?.is_fixed_price === true,
        fixedPriceAmountGbp,
      },
      hasActiveBid,
      denialReasons,
    },
  };
}
