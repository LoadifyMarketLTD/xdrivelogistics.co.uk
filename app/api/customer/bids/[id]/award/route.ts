import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const AWARD_ROLES = new Set(['owner', 'admin', 'dispatcher']);

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

  // The original creator may award their own job. Every other company user must
  // hold an active operational role; finance, viewer, member and driver roles
  // are intentionally read-only for commercial award decisions.
  const isCreator = job.created_by === user.id;
  if (!isCreator) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('role_in_company, status')
      .eq('user_id', user.id)
      .eq('company_id', job.company_id as string)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      return json(500, { error: 'Failed to verify company award permission.' });
    }

    const role = String(membership?.role_in_company ?? '').toLowerCase();
    if (!AWARD_ROLES.has(role)) {
      return json(403, {
        error: 'Forbidden - owner, admin or dispatcher role required to award bids.',
      });
    }
  }

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
    commercialAgreementId: result.commercial_agreement_id,
  });
}
