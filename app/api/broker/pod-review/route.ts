import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

async function resolveCallerMembership(
  request: NextRequest,
  companyId: string,
): Promise<{ userId: string } | null> {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const {
    data: { user },
    error: authErr,
  } = await validatorClient.auth.getUser(token);
  if (authErr || !user) return null;
  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!membership?.id) return null;
  return { userId: user.id };
}

// PATCH /api/broker/pod-review
// body: { jobId, companyId, action: 'approve' | 'reject' | 'request_missing', note? }
export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service is not configured.' });
  }

  let body: {
    jobId?: string;
    companyId?: string;
    action?: string;
    note?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const { jobId, companyId, action, note } = body;
  if (!jobId) return json(400, { error: 'jobId is required.' });
  if (!companyId) return json(400, { error: 'companyId is required.' });
  if (!action) return json(400, { error: 'action is required. Valid: approve, reject, request_missing.' });

  const validActions = ['approve', 'reject', 'request_missing'];
  if (!validActions.includes(action)) {
    return json(400, { error: `Unknown action. Use: ${validActions.join(', ')}.` });
  }

  const caller = await resolveCallerMembership(request, companyId);
  if (!caller) return json(403, { error: 'Forbidden — active broker membership required.' });

  // Verify job belongs to this broker's company
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id, status, delivery_photos, pod_photos')
    .eq('id', jobId)
    .maybeSingle();

  if (jobErr) return json(500, { error: jobErr.message });
  if (!job) return json(404, { error: 'Job not found.' });
  if (job.company_id !== companyId) {
    return json(403, { error: 'Forbidden — job belongs to a different company.' });
  }

  const reviewStatusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_missing: 'missing_requested',
  };

  const updatePayload: Record<string, unknown> = {
    broker_pod_review_status: reviewStatusMap[action],
    broker_pod_reviewed_at: new Date().toISOString(),
    broker_pod_reviewed_by: caller.userId,
  };
  if (note?.trim()) {
    updatePayload.broker_pod_review_note = note.trim();
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('jobs')
    .update(updatePayload)
    .eq('id', jobId)
    .select('id, broker_pod_review_status, broker_pod_reviewed_at, broker_pod_review_note')
    .single();

  if (updateErr) {
    // Gracefully handle case where broker_pod_review_status column doesn't yet exist
    if (updateErr.message?.includes('broker_pod_review_status')) {
      return json(503, {
        error: 'POD review columns not yet available. Apply migration 20260725160000 first.',
        migrationRequired: '20260725160000_broker_pod_review_status.sql',
      });
    }
    return json(500, { error: updateErr.message });
  }

  return json(200, { job: updated, action, success: true });
}
