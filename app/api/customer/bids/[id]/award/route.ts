import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

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

  const { id: bidId } = await params;
  if (!bidId) return json(400, { error: 'Bad request - missing bid id.' });

  // Pre-flight: verify the caller is authorised to award this bid.
  // The canonical accept_job_bid_atomic function authorises actors who are
  // either (a) the job's created_by user or (b) a company member with an
  // owner/admin/dispatcher role.  We do a lightweight ownership check here
  // so we can return a clear 403 before calling the DB function.
  const { data: bid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, status')
    .eq('id', bidId)
    .maybeSingle();

  if (bidError || !bid) return json(404, { error: 'Bid not found.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, created_by, exchange_visibility')
    .eq('id', bid.job_id as string)
    .maybeSingle();

  if (jobError || !job) return json(404, { error: 'Job not found.' });

  // Caller must be the job creator OR an active member of the owning company.
  const isCreator = job.created_by === user.id;
  if (!isCreator) {
    const { data: membership } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', job.company_id as string)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return json(403, { error: 'Forbidden - only the job owner can award bids.' });
    }
  }

  // Delegate to the canonical atomic award function.
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
    'accept_job_bid_atomic',
    {
      p_bid_id: bidId,
      p_actor_user_id: user.id,
    }
  );

  if (rpcError) {
    return json(500, { error: `Failed to award bid: ${rpcError.message}` });
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
