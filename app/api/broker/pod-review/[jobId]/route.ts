import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canonicalPodEvidence } from '../../../../../lib/pod/canonicalPodEvidence';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

type PodReviewAction = 'approve' | 'reject' | 'request_missing';

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_missing']),
  note: z.string().min(1).max(2000).optional(),
});

const resolveCallerCompany = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: json(503, { error: 'Service not configured.' }) };
  }
  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized — missing bearer token.' }) };

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json(401, { error: 'Unauthorized — invalid or expired token.' }) };
  }

  const { data: membership } = await supabaseAdmin
    .from('company_memberships')
    .select('company_id, role_in_company, status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { error: json(403, { error: 'An active broker owner, admin or dispatcher is required.' }) };
  }

  return { user: authData.user, companyId: membership.company_id as string };
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const resolved = await resolveCallerCompany(request);
  if ('error' in resolved) return resolved.error;
  const { user, companyId } = resolved;
  const admin = supabaseAdmin!;

  const { jobId } = await context.params;
  if (!jobId) return json(400, { error: 'Job ID is required.' });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Validation failed.', details: parsed.error.flatten() });
  }

  const { action, note } = parsed.data;

  // Verify job exists and is accessible to the broker company
  const { data: job, error: jobError } = await admin
    .from('jobs')
    .select('id, company_id, status, current_status, pod_required, pod_generated, delivery_photos, pod_photos, delivery_signature_data, client_signature_name, broker_pod_review_status')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return json(500, { error: jobError.message });
  if (!job) return json(404, { error: 'Job not found.' });
  if (job.company_id !== companyId) {
    return json(403, { error: 'Access denied — job is not managed by your company.' });
  }

  const pod = canonicalPodEvidence(job);

  if (action === 'approve' && !pod.complete) {
    return json(409, {
      error: 'Cannot approve POD until generated POD, delivery photo, recipient signature and recipient name are all recorded.',
      podState: pod.state,
    });
  }

  const actionLabels: Record<string, string> = {
    approve: 'POD_APPROVED',
    reject: 'POD_REJECTED',
    request_missing: 'POD_REQUESTED',
  };

  const defaultNotes: Record<string, string> = {
    approve: 'POD reviewed and approved by broker.',
    reject: 'POD rejected by broker — resubmission required.',
    request_missing: 'Broker has requested missing proof of delivery from the carrier.',
  };

  const noteText = `[${actionLabels[action]}] ${note ?? defaultNotes[action]}`;
  const reviewStatusMap: Record<PodReviewAction, string> = {
    approve: 'approved',
    reject: 'rejected',
    request_missing: 'missing_requested',
  };
  const reviewedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from('jobs')
    .update({
      broker_pod_review_status: reviewStatusMap[action],
      broker_pod_reviewed_at: reviewedAt,
      broker_pod_reviewed_by: user.id,
      broker_pod_review_note: note?.trim() || defaultNotes[action],
      updated_at: reviewedAt,
    })
    .eq('id', jobId)
    .eq('company_id', companyId)
    .select('id, broker_pod_review_status, broker_pod_reviewed_at, broker_pod_review_note')
    .maybeSingle();
  if (updateError) return json(500, { error: updateError.message });
  if (!updated) return json(409, { error: 'POD review could not be linked to this booking.' });

  const [{ error: noteError }, { error: eventError }] = await Promise.all([
    admin.from('job_notes').insert({
      job_id: jobId,
      company_id: companyId,
      created_by: user.id,
      note: noteText,
    }),
    admin.from('job_tracking_events').insert({
      job_id: jobId,
      event_type: 'note',
      created_by: user.id,
      message: noteText,
      meta: { kind: 'pod_review', action, pod_state: pod.state },
    }),
  ]);

  return json(200, {
    success: true,
    jobId,
    action,
    note: noteText,
    review: updated,
    auditWarning: noteError || eventError ? 'Review saved, but one audit record could not be written.' : null,
  });
}
