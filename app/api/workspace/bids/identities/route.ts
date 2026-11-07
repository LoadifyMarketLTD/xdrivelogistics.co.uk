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
const BID_VIEW_MEMBERSHIP_ROLES = new Set(['owner','admin','dispatcher','member','viewer','fleet_manager']);
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
    .filter((row) => BID_VIEW_MEMBERSHIP_ROLES.has(String(row.role_in_company ?? '').trim().toLowerCase()))
    .map((row) => String(row.company_id))
    .filter(Boolean))];
  if (!companyIds.length) return json(200, { identities: [] });

  const targetBidId = request.nextUrl.searchParams.get('bidId');
  if (targetBidId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetBidId)) return json(400, {error:'Invalid quote reference.'});

  // Resolve identities through the existing owner-scoped compatibility view.
  // This avoids depending on PostgREST relationship inference for jobs while
  // preserving the same company ownership boundary used by quote management.
  let bidQuery = supabaseAdmin
    .from('job_bids_with_job_owner')
    .select('id, bidder_company_id, bidder_driver_id, bidder_user_id, bidder_id, owner_company_id')
    .in('owner_company_id', companyIds);
  if (targetBidId) bidQuery = bidQuery.eq('id', targetBidId);
  const {data:bidData,error:bidError} = await bidQuery;

  if (bidError) return json(500, { error: 'Unable to load bidder identities.' });
  const bids = (bidData ?? []) as unknown as BidIdentityRow[];

  try {
    const bidIds=bids.map(bid=>bid.id);
    const {data:vehicleQuotes,error:vehicleQuoteError}=bidIds.length?await supabaseAdmin.from('job_bids').select('id,quote_vehicle_id').in('id',bidIds):{data:[],error:null};
    if(vehicleQuoteError)return json(503,{error:'Quoted vehicle references could not be retrieved.'});
    const vehicleByQuote=new Map((vehicleQuotes??[]).map(q=>[q.id,q.quote_vehicle_id]));
    const decisionCompanyIds = new Set((memberships ?? []).filter(row => BID_DECISION_MEMBERSHIP_ROLES.has(String(row.role_in_company ?? '').toLowerCase())).map(row => String(row.company_id)));
    const selectedBid = targetBidId ? (bidData??[]).find(row => row.id === targetBidId) : null;
    const allowSensitiveCompliance=Boolean(selectedBid && decisionCompanyIds.has(String(selectedBid.owner_company_id)));
    const identities = await enrichBidderDecisionIdentities(supabaseAdmin, bids.map((bid) => ({
      bidId: bid.id,
      companyId: bid.bidder_company_id ?? null,
      driverId: bid.bidder_driver_id ?? null,
      userId: bid.bidder_user_id ?? bid.bidder_id ?? null,
      quoteVehicleId: vehicleByQuote.get(bid.id)??null,
    })), {includeCompliance:allowSensitiveCompliance});
    if(!allowSensitiveCompliance){for(const identity of identities){identity.businessPhone=null;identity.driverDocumentStatuses={};identity.vehicleDocumentStatuses={};identity.complianceRetrieved=false;}}
    return json(200, { identities });
  } catch {
    return json(500, { error: 'Unable to enrich bidder decision profiles.' });
  }
}
