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
  action: z.enum(['resolve', 'escalate']),
  resolution_note: z.string().min(1).max(2000).optional(),
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

  const managerRoles = ['owner', 'admin', 'company_admin', 'admin_staff', 'company'];
  if (!managerRoles.includes(membership.role_in_company)) {
    return { error: json(403, { error: 'Admin or owner role required to manage disputes.' }) };
  }

  return { user: authData.user, companyId: membership.company_id as string };
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const resolved = await resolveCallerCompany(request);
  if ('error' in resolved) return resolved.error;
  const { user, companyId } = resolved;
  const admin = supabaseAdmin!;

  const { id: disputeId } = await context.params;
  if (!disputeId) return json(400, { error: 'Dispute ID is required.' });

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

  const { action, resolution_note } = parsed.data;

  // Verify the dispute is accessible to this broker company
  const { data: dispute, error: fetchError } = await admin
    .from('job_disputes')
    .select('id, status, job_id, raised_by_company_id')
    .eq('id', disputeId)
    .maybeSingle();

  if (fetchError) return json(500, { error: fetchError.message });
  if (!dispute) return json(404, { error: 'Dispute not found.' });

  // Broker can manage disputes for jobs in their company's scope
  // (either raised by them or belonging to a job they manage)
  const { data: job } = await admin
    .from('jobs')
    .select('id, company_id')
    .eq('id', dispute.job_id)
    .maybeSingle();

  const hasAccess =
    dispute.raised_by_company_id === companyId ||
    job?.company_id === companyId;

  if (!hasAccess) {
    return json(403, { error: 'Access denied — dispute is not within your company scope.' });
  }

  if (['resolved', 'closed'].includes(dispute.status)) {
    return json(400, { error: 'This dispute is already resolved.' });
  }

  const nextStatus = action === 'resolve' ? 'resolved' : 'investigating';
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (action === 'resolve') {
    updatePayload.resolution_note = resolution_note ?? 'Resolved by broker.';
    updatePayload.resolved_at = new Date().toISOString();
  } else {
    updatePayload.resolution_note = resolution_note ?? 'Escalated for investigation.';
  }

  const { data: updated, error: updateError } = await admin
    .from('job_disputes')
    .update(updatePayload)
    .eq('id', disputeId)
    .select('id, status, resolution_note, resolved_at, updated_at')
    .maybeSingle();

  if (updateError) return json(500, { error: updateError.message });

  // Audit note
  await admin.from('job_notes').insert({
    job_id: dispute.job_id,
    company_id: companyId,
    created_by: user.id,
    note: `[DISPUTE_${action.toUpperCase()}] ${resolution_note ?? (action === 'resolve' ? 'Resolved by broker.' : 'Escalated for investigation.')}`,
  });

  return json(200, { dispute: updated, action });
}
