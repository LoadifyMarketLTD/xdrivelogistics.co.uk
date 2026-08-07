import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status });

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open: ['investigating', 'resolved', 'closed'],
  investigating: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

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

// PATCH /api/broker/disputes — update dispute status or add resolution note
export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Service is not configured.' });
  }

  let body: {
    disputeId?: string;
    companyId?: string;
    action?: string;
    resolutionNote?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const { disputeId, companyId, action, resolutionNote } = body;
  if (!disputeId) return json(400, { error: 'disputeId is required.' });
  if (!companyId) return json(400, { error: 'companyId is required.' });
  if (!action) return json(400, { error: 'action is required. Valid: investigate, resolve, close, escalate.' });

  const caller = await resolveCallerMembership(request, companyId);
  if (!caller) return json(403, { error: 'Forbidden — active broker membership required.' });

  // Fetch dispute and confirm it relates to broker's job
  const { data: dispute, error: fetchErr } = await supabaseAdmin
    .from('job_disputes')
    .select('id, status, job_id')
    .eq('id', disputeId)
    .maybeSingle();

  if (fetchErr) return json(500, { error: fetchErr.message });
  if (!dispute) return json(404, { error: 'Dispute not found.' });

  // Confirm the job is associated with this broker's company
  const { data: job } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('id', dispute.job_id as string)
    .maybeSingle();

  if (!job) return json(404, { error: 'Related job not found.' });
  if (job.company_id !== companyId) {
    return json(403, { error: 'Forbidden — dispute belongs to a different company.' });
  }

  const statusMap: Record<string, string> = {
    investigate: 'investigating',
    resolve: 'resolved',
    close: 'closed',
    escalate: 'investigating', // escalate keeps it in investigating with a note
  };

  const newStatus = statusMap[action];
  if (!newStatus) {
    return json(400, { error: `Unknown action "${action}". Use: investigate, resolve, close, escalate.` });
  }

  const currentStatus = dispute.status as string;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    return json(409, {
      error: `Cannot transition from "${currentStatus}" to "${newStatus}".`,
      currentStatus,
      newStatus,
    });
  }

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (resolutionNote?.trim()) {
    updatePayload.resolution_note = resolutionNote.trim();
  }
  if (action === 'escalate') {
    const existingNote = resolutionNote?.trim() ?? '';
    updatePayload.resolution_note = `[ESCALATED by broker] ${existingNote}`.trim();
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('job_disputes')
    .update(updatePayload)
    .eq('id', disputeId)
    .select('id, status, resolution_note, updated_at')
    .single();

  if (updateErr) return json(500, { error: updateErr.message });

  return json(200, { dispute: updated, success: true });
}
