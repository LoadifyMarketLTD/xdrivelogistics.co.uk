import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';
import { enrichBidderDecisionIdentities } from '../../../_lib/bidderDecisionIdentity';

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
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

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
    .filter((membership) => ['owner', 'admin', 'dispatcher'].includes(String(membership.role_in_company)))
    .map((membership) => String(membership.company_id));

  if (ownerCompanyIds.length === 0) return NextResponse.json({ identities: [] });

  const { data: bidData, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, company_id, bidder_driver_id, bidder_user_id, bidder_id, jobs!inner(company_id)')
    .in('jobs.company_id', ownerCompanyIds);

  if (bidError) return NextResponse.json({ error: 'Unable to load bidder identities.' }, { status: 500 });

  const bids = (bidData ?? []) as unknown as BidIdentityRow[];
  try {
    const identities = await enrichBidderDecisionIdentities(supabaseAdmin, bids.map((bid) => ({
      bidId: bid.id,
      companyId: bid.company_id ?? null,
      driverId: bid.bidder_driver_id ?? null,
      userId: bid.bidder_user_id ?? bid.bidder_id ?? null,
    })));
    return NextResponse.json({ identities });
  } catch {
    return NextResponse.json({ error: 'Unable to enrich bidder decision profiles.' }, { status: 500 });
  }
}
