import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { hasBidDecisionRole } from '../../../../admin/bids/_lib/ownerRoles';

type Params = { params: Promise<{ id: string }> };

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not available — admin client not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized — no bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);
  if (authError || !user) return json(401, { error: 'Unauthorized — invalid token.' });

  const { id: bidId } = await params;
  if (!bidId) return json(400, { error: 'Missing bid id.' });

  const { data: bidJob, error: bidJobError } = await supabaseAdmin
    .from('job_bids')
    .select('id, jobs!inner(company_id)')
    .eq('id', bidId)
    .maybeSingle();

  if (bidJobError || !bidJob || !bidJob.jobs) return json(404, { error: 'Bid not found.' });

  const bidJobRelation = Array.isArray(bidJob.jobs) ? bidJob.jobs[0] : bidJob.jobs;
  const jobCompanyId = (bidJobRelation as { company_id?: string } | null)?.company_id;
  if (!jobCompanyId) return json(404, { error: 'Bid not found.' });

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company, companies!inner(status)')
    .eq('user_id', user.id)
    .eq('company_id', jobCompanyId)
    .eq('status', 'active')
    .eq('companies.status', 'active')
    .maybeSingle();

  if (membershipError || !membership) {
    return json(403, { error: 'Forbidden — you are not a member of the load-owning company.' });
  }

  if (!hasBidDecisionRole(membership.role_in_company as string | null)) {
    return json(403, { error: 'Forbidden — insufficient role to award bids.' });
  }

  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('accept_job_bid_atomic', {
    p_bid_id: bidId,
    p_actor_user_id: user.id,
  });

  if (rpcError) return json(500, { error: `Failed to award bid: ${rpcError.message}` });

  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (!result?.success) {
    return json(result?.http_status ?? 500, { error: result?.error_message ?? 'Award failed.' });
  }

  return json(200, {
    success: true,
    bidId: result.bid_id,
    jobId: result.job_id,
    awardedCarrierCompanyId: result.awarded_carrier_company_id,
  });
}
