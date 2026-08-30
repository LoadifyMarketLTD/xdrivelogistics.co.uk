import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

type BidIdentityRow = {
  id: string;
  bidder_company_id: string | null;
  bidder_driver_id: string | null;
  bidder_user_id: string | null;
  bidder_id: string | null;
};

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const BID_DECISION_MEMBERSHIP_ROLES = new Set(['owner', 'admin', 'dispatcher']);

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Bidder identity service is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: 'Unauthorized.' });

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (membershipError) {
    return json(500, { error: 'Unable to verify company access.' });
  }

  const companyIds = [...new Set((memberships ?? [])
    .filter((row) => BID_DECISION_MEMBERSHIP_ROLES.has(String(row.role_in_company ?? '').trim().toLowerCase()))
    .map((row) => String(row.company_id))
    .filter(Boolean))];
  if (!companyIds.length) return json(200, { identities: [] });

  // Resolve identities through the existing owner-scoped compatibility view.
  // This avoids depending on PostgREST relationship inference for jobs while
  // preserving the same company ownership boundary used by quote management.
  const { data: bidData, error: bidError } = await supabaseAdmin
    .from('job_bids_with_job_owner')
    .select('id, bidder_company_id, bidder_driver_id, bidder_user_id, bidder_id, owner_company_id')
    .in('owner_company_id', companyIds);

  if (bidError) return json(500, { error: 'Unable to load bidder identities.' });
  const bids = (bidData ?? []) as unknown as BidIdentityRow[];

  const driverIds = [...new Set(bids.map((bid) => bid.bidder_driver_id).filter((id): id is string => Boolean(id)))];
  const userIds = [...new Set(bids.map((bid) => bid.bidder_user_id ?? bid.bidder_id).filter((id): id is string => Boolean(id)))];

  const [driversResult, profilesResult] = await Promise.all([
    driverIds.length
      ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabaseAdmin.from('profiles').select('user_id, full_name, company_id').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (driversResult.error || profilesResult.error) {
    return json(500, { error: 'Unable to resolve bidder profiles.' });
  }

  const drivers = new Map((driversResult.data ?? []).map((row) => [row.id, row]));
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.user_id, row]));

  const resolvedCompanyIds = [...new Set(bids.map((bid) => {
    const driver = bid.bidder_driver_id ? drivers.get(bid.bidder_driver_id) : null;
    const profile = profiles.get(bid.bidder_user_id ?? bid.bidder_id ?? '') ?? null;
    return bid.bidder_company_id ?? driver?.company_id ?? profile?.company_id ?? null;
  }).filter((id): id is string => Boolean(id)))];

  const companiesResult = resolvedCompanyIds.length
    ? await supabaseAdmin.from('companies').select('id, name, company_type').in('id', resolvedCompanyIds)
    : { data: [], error: null };
  if (companiesResult.error) return json(500, { error: 'Unable to resolve bidder companies.' });
  const companies = new Map((companiesResult.data ?? []).map((row) => [row.id, row]));

  const identities = bids.map((bid) => {
    const driver = bid.bidder_driver_id ? drivers.get(bid.bidder_driver_id) : null;
    const profile = profiles.get(bid.bidder_user_id ?? bid.bidder_id ?? '') ?? null;
    const companyId = bid.bidder_company_id ?? driver?.company_id ?? profile?.company_id ?? null;
    const company = companyId ? companies.get(companyId) : null;
    const companyName = company?.name?.trim() || null;
    const personName = driver?.display_name?.trim() || profile?.full_name?.trim() || null;

    return {
      bidId: bid.id,
      companyId,
      driverId: bid.bidder_driver_id ?? null,
      companyName,
      personName,
      companyType: company?.company_type?.trim() || (companyId ? null : 'owner_driver'),
      displayName: companyName || personName || 'Carrier profile incomplete',
    };
  });

  return json(200, { identities });
}
