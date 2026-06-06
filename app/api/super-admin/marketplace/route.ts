import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type MarketplaceRow = {
  id: string;
  status: string;
  company_id: string;
  awarded_carrier_company_id: string | null;
  created_at: string;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
};

type CompanyRow = { id: string; name: string };
type BidRow = { job_id: string };

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
};

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;
  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 200) || 200, 500);

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, status, company_id, awarded_carrier_company_id, created_at, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (jobsError) {
    return respond(500, { error: jobsError.message });
  }

  const marketplaceRows = (jobs ?? []) as MarketplaceRow[];
  if (marketplaceRows.length === 0) {
    return respond(200, { jobs: [] });
  }

  const companyIds = Array.from(
    new Set(
      marketplaceRows
        .flatMap((job) => [job.company_id, job.awarded_carrier_company_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [companiesResult, bidCountsResult] = await Promise.all([
    supabaseAdmin.from('companies').select('id, name').in('id', companyIds),
    supabaseAdmin.from('job_bids').select('job_id').in('job_id', marketplaceRows.map((job) => job.id)),
  ]);

  if (companiesResult.error) {
    return respond(500, { error: companiesResult.error.message });
  }

  if (bidCountsResult.error) {
    return respond(500, { error: bidCountsResult.error.message });
  }

  const companyNameById = new Map<string, string>((companiesResult.data as CompanyRow[]).map((row) => [row.id, row.name]));
  const bidCountByJobId = new Map<string, number>();
  for (const row of (bidCountsResult.data as BidRow[])) {
    bidCountByJobId.set(row.job_id, (bidCountByJobId.get(row.job_id) ?? 0) + 1);
  }

  return respond(200, {
    jobs: marketplaceRows.map((job) => ({
      ...job,
      posting_company_name: companyNameById.get(job.company_id) ?? 'Unknown company',
      awarded_company_name: job.awarded_carrier_company_id
        ? (companyNameById.get(job.awarded_carrier_company_id) ?? 'Unknown company')
        : null,
      bids_count: bidCountByJobId.get(job.id) ?? 0,
    })),
  });
}
