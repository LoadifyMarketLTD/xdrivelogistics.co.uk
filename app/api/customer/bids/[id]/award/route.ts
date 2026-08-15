import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../_lib/platformFlags';

type Params = { params: Promise<{ id: string }> };

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service not available - admin client not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized - no bearer token.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authError,
  } = await validatorClient.auth.getUser(token);

  if (authError || !user) return json(401, { error: 'Unauthorized - invalid token.' });

  const bidAcceptanceEnabled = await getFeatureFlag(supabaseAdmin, 'bid_acceptance_workflow');
  if (!bidAcceptanceEnabled) {
    return json(503, { error: 'Bid acceptance workflow is currently disabled.' });
  }

  const { id: bidId } = await params;
  if (!bidId) return json(400, { error: 'Bad request - missing bid id.' });

  const { data: bid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, status')
    .eq('id', bidId)
    .maybeSingle();

  if (bidError || !bid) return json(404, { error: 'Bid not found.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('id', bid.job_id as string)
    .maybeSingle();

  if (jobError || !job) return json(404, { error: 'Job not found.' });

  // Mirror accept_job_bid_atomic exactly: only an active owner/admin/dispatcher
  // of the company that owns the job may make the commercial award. Job
  // creator identity alone is not an authorisation contract.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company')
    .eq('user_id', user.id)
    .eq('company_id', job.company_id as string)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .maybeSingle();

  if (membershipError) {
    return json(500, { error: 'Award permission could not be verified.' });
  }
  if (!membership) {
    return json(403, { error: 'Forbidden - an active owner, admin or dispatcher of the job-owning company is required to award bids.' });
  }

  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    'accept_job_bid_atomic',
    {
      p_bid_id: bidId,
      p_actor_user_id: user.id,
    }
  );

  if (rpcError) {
    const status = rpcError.code === '42501' ? 403 : rpcError.code === '23514' ? 409 : 500;
    return json(status, { error: `Failed to award bid: ${rpcError.message}` });
  }

  const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
  if (!result?.success) {
    return json(result?.http_status ?? 500, {
      error: result?.error_message ?? 'Award failed.',
    });
  }

  return json(200, {
    success: true,
    bidId: result.bid_id,
    jobId: result.job_id,
    awardedCarrierCompanyId: result.awarded_carrier_company_id,
  });
}
