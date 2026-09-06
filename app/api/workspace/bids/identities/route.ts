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

  try {
    const identities = await enrichBidderDecisionIdentities(supabaseAdmin, bids.map((bid) => ({
      bidId: bid.id,
      companyId: bid.bidder_company_id ?? null,
      driverId: bid.bidder_driver_id ?? null,
      userId: bid.bidder_user_id ?? bid.bidder_id ?? null,
    })));
    return json(200, { identities });
  } catch {
    return json(500, { error: 'Unable to enrich bidder decision profiles.' });
  }
}
