import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

type BidIdentityRow = {
  id: string;
  company_id: string | null;
  bidder_driver_id: string | null;
  bidder_user_id: string | null;
  bidder_id: string | null;
  jobs: { company_id: string } | { company_id: string }[] | null;
};

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return NextResponse.json({ error: 'Carrier identity service is not configured.' }, { status: 503 });
  }

  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company, companies!inner(status)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('companies.status', 'active');

  if (membershipError) {
    return NextResponse.json({ error: 'Unable to verify company access.' }, { status: 500 });
  }

  const ownerCompanyIds = (memberships ?? [])
    .filter((membership) => ['owner', 'admin', 'dispatcher', 'viewer'].includes(String(membership.role_in_company)))
    .map((membership) => String(membership.company_id));

  if (ownerCompanyIds.length === 0) {
    return NextResponse.json({ identities: [] });
  }

  const { data: bidData, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, company_id, bidder_driver_id, bidder_user_id, bidder_id, jobs!inner(company_id)')
    .in('jobs.company_id', ownerCompanyIds);

  if (bidError) {
    return NextResponse.json({ error: 'Unable to load bidder identities.' }, { status: 500 });
  }

  const bids = (bidData ?? []) as unknown as BidIdentityRow[];
  const companyIds = [...new Set(bids.map((bid) => bid.company_id).filter((id): id is string => Boolean(id)))];
  const driverIds = [...new Set(bids.map((bid) => bid.bidder_driver_id).filter((id): id is string => Boolean(id)))];
  const userIds = [...new Set(bids.map((bid) => bid.bidder_user_id ?? bid.bidder_id).filter((id): id is string => Boolean(id)))];

  const [companiesResult, driversResult, profilesResult] = await Promise.all([
    companyIds.length
      ? supabaseAdmin.from('companies').select('id, name, company_type').in('id', companyIds)
      : Promise.resolve({ data: [], error: null }),
    driverIds.length
      ? supabaseAdmin.from('drivers').select('id, display_name, company_id').in('id', driverIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabaseAdmin.from('profiles').select('user_id, full_name, company_id').in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (companiesResult.error || driversResult.error || profilesResult.error) {
    return NextResponse.json({ error: 'Unable to resolve bidder profiles.' }, { status: 500 });
  }

  const companies = new Map((companiesResult.data ?? []).map((row) => [row.id, row]));
  const drivers = new Map((driversResult.data ?? []).map((row) => [row.id, row]));
  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.user_id, row]));

  const identities = bids.map((bid) => {
    const driver = bid.bidder_driver_id ? drivers.get(bid.bidder_driver_id) : null;
    const profile = profiles.get(bid.bidder_user_id ?? bid.bidder_id ?? '') ?? null;
    const companyId = bid.company_id ?? driver?.company_id ?? profile?.company_id ?? null;
    const company = companyId ? companies.get(companyId) : null;
    const companyName = company?.name?.trim() || null;
    const personName = driver?.display_name?.trim() || profile?.full_name?.trim() || null;

    return {
      bidId: bid.id,
      companyName,
      companyType: company?.company_type?.trim() || null,
      personName,
      displayName: companyName || personName || 'Carrier profile incomplete',
    };
  });

  return NextResponse.json({ identities });
}
