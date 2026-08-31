import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type MarketplaceGovernanceMutationRow = {
  id: string;
  status: string;
  company_id: string;
  exchange_visibility: string;
};

/**
 * Actions that require an explicit reason.
 * Force-cancel and force-dispute have immediate operational/financial impact.
 */
const MARKETPLACE_REASON_REQUIRED = new Set(['force_dispute', 'force_cancel']);

const patchSchema = z.object({
  action: z.enum(['publish_to_exchange', 'hide_from_exchange', 'force_dispute', 'force_cancel']),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (MARKETPLACE_REASON_REQUIRED.has(data.action) && !data.reason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reason'],
      message: `A reason is required for the '${data.action}' action.`,
    });
  }
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const owner = await verifyPlatformOwner(request);
  if (!owner) {
    return respond(403, { error: 'Forbidden: active Platform Owner required.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const flatErrors = parsed.error.flatten();
    const firstIssue = parsed.error.issues[0];
    return respond(400, { error: firstIssue?.message ?? 'Invalid action payload.', fields: flatErrors.fieldErrors });
  }

  const { id: jobId } = await params;
  const { action, reason } = parsed.data;
  const { data: mutationResult, error: mutationError } = await supabaseAdmin.rpc(
    'apply_marketplace_governance_action',
    {
      p_actor_user_id: owner.id,
      p_job_id: jobId,
      p_action: action,
      p_reason: reason?.trim() || null,
    },
  );

  if (mutationError) {
    if (mutationError.code === 'P0002') {
      return respond(404, { error: mutationError.message });
    }
    if (mutationError.code === '22P02') {
      return respond(400, { error: mutationError.message });
    }
    if (mutationError.code === 'P0001' || mutationError.code === '23514' || mutationError.code === '23502') {
      return respond(409, { error: mutationError.message });
    }
    return respond(500, { error: mutationError.message });
  }

  const updatedJob = (Array.isArray(mutationResult) ? mutationResult[0] : mutationResult) as
    | MarketplaceGovernanceMutationRow
    | null;

  return respond(200, {
    success: true,
    action,
    job: updatedJob,
  });
}
