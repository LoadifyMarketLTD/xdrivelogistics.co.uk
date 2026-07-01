import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const resolveBrokerCompanyIds = async (userId: string) => {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher']);
  return (data ?? [])
    .map((row) => row.company_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
};

const handle = async (request: NextRequest, { params }: Params) => {
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

  const { id: jobId } = await params;
  if (!jobId) return json(400, { error: 'Missing load id.' });

  const companyIds = await resolveBrokerCompanyIds(user.id);
  if (!companyIds.length) return json(403, { error: 'Forbidden.' });

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) return json(404, { error: 'Load not found.' });
  if (!companyIds.includes(job.company_id as string)) return json(403, { error: 'Forbidden.' });

  const { data: bids, error: bidsError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, company_id, bidder_user_id, bid_price_gbp, amount, currency, message, status, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (bidsError) return json(500, { error: bidsError.message });
  return json(200, { success: true, bids: bids ?? [] });
};

export async function GET(request: NextRequest, context: Params) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: Params) {
  return handle(request, context);
}
