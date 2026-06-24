import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';
import { resolveAuthoritativeRole } from '../../../../../../lib/authRole';

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

  const [{ data: profile }, { data: bid, error: bidError }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('role, is_driver')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      .from('job_bids')
      .select('id, job_id, company_id, status, amount, bid_price_gbp')
      .eq('id', bidId)
      .maybeSingle(),
  ]);

  if (bidError || !bid) return json(404, { error: 'Bid not found.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, created_by, status, exchange_visibility, awarded_carrier_company_id, status_history')
    .eq('id', bid.job_id as string)
    .maybeSingle();

  if (jobError || !job) return json(404, { error: 'Job not found.' });

  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('id, role_in_company, status')
    .eq('user_id', user.id)
    .eq('company_id', job.company_id as string)
    .eq('status', 'active')
    .maybeSingle();

  const appRole = resolveAuthoritativeRole({
    profileRole: (profile?.role as string | null) ?? null,
    fallbackRole: (user.app_metadata?.role as string | undefined) ?? null,
    membershipRole: (membership?.role_in_company as string | null) ?? null,
    isDriver: profile?.is_driver === true,
    hasCreatedCompany: job.created_by === user.id,
    creatorCompanyType: null,
    ownerDriverWorkspaceRequested: false,
  });

  const ownsJob = job.created_by === user.id || Boolean(membership);
  if (appRole !== 'customer' || !ownsJob) {
    return json(403, { error: 'Forbidden - only the customer who owns this load can award bids.' });
  }

  if (!['exchange', 'direct'].includes((job.exchange_visibility as string | null) ?? '')) {
    return json(400, { error: 'Bad request - this job is not open for carrier bids.' });
  }

  if (bid.status !== 'submitted') {
    return json(409, { error: 'Conflict - only submitted bids can be awarded.' });
  }

  if (job.awarded_carrier_company_id) {
    return json(409, { error: 'Conflict - this job has already been awarded.' });
  }

  if (!bid.company_id) {
    return json(409, { error: 'Conflict - bid company is missing.' });
  }

  const now = new Date().toISOString();
  const currentHistory = Array.isArray(job.status_history) ? job.status_history : [];

  const { error: acceptedError } = await supabaseAdmin
    .from('job_bids')
    .update({ status: 'accepted' })
    .eq('id', bidId)
    .eq('status', 'submitted');

  if (acceptedError) return json(500, { error: `Failed to award bid: ${acceptedError.message}` });

  await supabaseAdmin
    .from('job_bids')
    .update({ status: 'rejected' })
    .eq('job_id', job.id as string)
    .neq('id', bidId)
    .eq('status', 'submitted');

  const { error: jobUpdateError } = await supabaseAdmin
    .from('jobs')
    .update({
      awarded_carrier_company_id: bid.company_id,
      status: 'awarded',
      status_history: [
        ...currentHistory,
        {
          status: 'awarded',
          timestamp: now,
          bid_id: bidId,
          awarded_by: user.id,
          awarded_carrier_company_id: bid.company_id,
        },
      ],
      updated_at: now,
    })
    .eq('id', job.id as string)
    .is('awarded_carrier_company_id', null);

  if (jobUpdateError) return json(500, { error: `Failed to update job award: ${jobUpdateError.message}` });

  await supabaseAdmin.from('job_tracking_events').insert({
    job_id: job.id,
    created_by: user.id,
    event_type: 'allocated',
    message: 'Customer awarded carrier quote.',
    meta: {
      bid_id: bidId,
      awarded_by: user.id,
      awarded_at: now,
      awarded_carrier_company_id: bid.company_id,
      amount: bid.bid_price_gbp ?? bid.amount ?? null,
    },
  });

  return json(200, {
    success: true,
    bidId,
    jobId: job.id,
    awardedCarrierCompanyId: bid.company_id,
  });
}
