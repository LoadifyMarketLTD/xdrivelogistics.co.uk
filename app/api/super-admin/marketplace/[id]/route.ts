import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type MarketplaceRow = {
  id: string;
  status: string;
  company_id: string;
  exchange_visibility: string;
};

const patchSchema = z.object({
  action: z.enum(['publish_to_exchange', 'hide_from_exchange', 'force_dispute', 'force_cancel']),
  reason: z.string().trim().max(1000).optional(),
});

type MarketplaceAction = z.infer<typeof patchSchema>['action'];
type MarketplaceStatus = 'draft' | 'posted' | 'allocated' | 'in_transit' | 'delivered' | 'cancelled' | 'disputed';

const ACTION_TO_AUDIT_TYPE: Record<MarketplaceAction, string> = {
  publish_to_exchange: 'marketplace_published',
  hide_from_exchange: 'marketplace_hidden',
  force_dispute: 'marketplace_job_disputed',
  force_cancel: 'marketplace_job_cancelled',
};

const STATUS_MUTATION_ALLOWED = new Set<MarketplaceStatus>(['draft', 'posted', 'allocated', 'in_transit']);

const resolveOwnerProfile = async (authUserId: string) => {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
};

const verifyOwner = async (request: NextRequest) => {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) return null;
  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') return null;
  return authData.user;
};

const buildActionMutation = (job: MarketplaceRow, action: MarketplaceAction) => {
  const normalizedStatus = String(job.status ?? '').trim().toLowerCase() as MarketplaceStatus;

  if (action === 'publish_to_exchange') {
    if (!['draft', 'posted'].includes(normalizedStatus)) {
      return { error: `Cannot publish job in '${normalizedStatus}' status to exchange.` };
    }
    if (job.exchange_visibility === 'exchange') {
      return { error: 'Job is already visible on exchange.' };
    }
    return {
      patch: {
        exchange_visibility: 'exchange',
        exchange_posted_at: new Date().toISOString(),
      },
      oldValue: `visibility:${job.exchange_visibility}`,
      newValue: 'visibility:exchange',
    };
  }

  if (action === 'hide_from_exchange') {
    if (job.exchange_visibility !== 'exchange') {
      return { error: `Job visibility is '${job.exchange_visibility}', not exchange.` };
    }
    return {
      patch: {
        exchange_visibility: 'private',
      },
      oldValue: `visibility:${job.exchange_visibility}`,
      newValue: 'visibility:private',
    };
  }

  if (!STATUS_MUTATION_ALLOWED.has(normalizedStatus)) {
    return { error: `Cannot change status from '${normalizedStatus}'.` };
  }

  if (action === 'force_dispute') {
    return {
      patch: { status: 'disputed' },
      oldValue: normalizedStatus,
      newValue: 'disputed',
    };
  }

  return {
    patch: { status: 'cancelled' },
    oldValue: normalizedStatus,
    newValue: 'cancelled',
  };
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyOwner(request);
  if (!owner) {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid action payload.' });
  }

  const { id: jobId } = await params;
  const { action, reason } = parsed.data;

  const { data: currentJob, error: currentJobError } = await supabaseAdmin
    .from('jobs')
    .select('id, status, company_id, exchange_visibility')
    .eq('id', jobId)
    .limit(1)
    .maybeSingle();

  if (currentJobError) {
    return respond(500, { error: currentJobError.message });
  }

  if (!currentJob) {
    return respond(404, { error: 'Marketplace job not found.' });
  }

  const mutation = buildActionMutation(currentJob as MarketplaceRow, action);
  if ('error' in mutation) {
    return respond(409, { error: mutation.error });
  }

  const { patch, oldValue, newValue } = mutation;
  const auditReason = reason?.trim() || `Marketplace action '${action}' executed by owner governance.`;
  const auditActionType = ACTION_TO_AUDIT_TYPE[action];

  const { data: updatedJob, error: updateError } = await supabaseAdmin
    .from('jobs')
    .update(patch)
    .eq('id', jobId)
    .select('id, status, company_id, exchange_visibility')
    .limit(1)
    .maybeSingle();

  if (updateError) {
    if (updateError.code === '23514' || updateError.code === 'P0001') {
      return respond(409, { error: updateError.message });
    }
    return respond(500, { error: updateError.message });
  }

  const { error: auditInsertError } = await supabaseAdmin
    .from('owner_audit_log')
    .insert({
      actor_user_id: owner.id,
      target_company_id: currentJob.company_id,
      action_type: auditActionType,
      old_status: oldValue,
      new_status: newValue,
      reason: auditReason,
    });

  if (auditInsertError) {
    return respond(500, { error: `Action applied but audit logging failed: ${auditInsertError.message}` });
  }

  return respond(200, {
    success: true,
    action,
    job: updatedJob,
  });
}
