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

  // Parse optional rejection reason from body
  let rejectionReason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: string };
    rejectionReason = body.reason?.trim() ?? null;
  } catch {
    // body is optional
  }

  const { data: bid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, status, company_id')
    .eq('id', bidId)
    .maybeSingle();

  if (bidError || !bid) return json(404, { error: 'Bid not found.' });

  if (bid.status !== 'submitted') {
    return json(409, {
      error: `Cannot reject bid with status "${bid.status}". Only submitted bids can be rejected.`,
    });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, created_by, status')
    .eq('id', bid.job_id as string)
    .maybeSingle();

  if (jobError || !job) return json(404, { error: 'Job not found.' });

  // Caller must be the job creator OR an active member of the owning company
  const isCreator = job.created_by === user.id;
  if (!isCreator) {
    const { data: membership } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', job.company_id as string)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!membership?.id) {
      return json(403, { error: 'Forbidden - you are not authorised to reject bids for this job.' });
    }
  }

  // Update bid status to rejected
  const updatePayload: Record<string, unknown> = { status: 'rejected' };
  if (rejectionReason) {
    updatePayload.message = `[REJECTED] ${rejectionReason}`;
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('job_bids')
    .update(updatePayload)
    .eq('id', bidId)
    .select('id, status, job_id, company_id')
    .single();

  if (updateErr) return json(500, { error: updateErr.message });

  return json(200, { bid: updated, success: true, message: 'Bid rejected successfully.' });
}
