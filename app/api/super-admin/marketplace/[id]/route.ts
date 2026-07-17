import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type MarketplaceGovernanceMutationRow = {
  id: string;
  status: string;
  company_id: string;
  exchange_visibility: string;
};

const patchSchema = z.object({
  action: z.enum(['publish_to_exchange', 'hide_from_exchange', 'force_dispute', 'force_cancel']),
  reason: z.string().trim().max(1000).optional(),
});

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
