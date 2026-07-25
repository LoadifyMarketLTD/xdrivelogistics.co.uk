import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

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
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { error: json(403, { error: 'Active company membership required.' }) };
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
    .select('id, company_id, status, current_status, delivery_photos')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError) return json(500, { error: jobError.message });
  if (!job) return json(404, { error: 'Job not found.' });
  if (job.company_id !== companyId) {
    return json(403, { error: 'Access denied — job is not managed by your company.' });
  }

  const deliveryPhotos = Array.isArray(job.delivery_photos) ? job.delivery_photos : [];

  if (action === 'approve' && deliveryPhotos.length === 0) {
    return json(400, { error: 'Cannot approve POD — no delivery photos have been uploaded.' });
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

  const { error: insertError } = await admin.from('job_notes').insert({
    job_id: jobId,
    company_id: companyId,
    created_by: user.id,
    note: noteText,
  });

  if (insertError) return json(500, { error: insertError.message });

  return json(200, { success: true, jobId, action, note: noteText });
}
