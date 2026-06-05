import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

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

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'reinstate', 'suspend']),
});

/**
 * PATCH /api/super-admin/companies/[id]
 * Owner-only: approve | reject | reinstate | suspend a company.
 * - approve  → status = 'active'
 * - reject   → status = 'rejected'
 * - reinstate → status = 'active'
 * - suspend  → status = 'suspended'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  // Auth check BEFORE payload validation (403 before 400)
  const token = getBearerToken(request);
  if (!token) {
    return respond(401, { error: 'Unauthorized.' });
  }

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized: invalid or expired token.' });
  }

  const profile = await resolveOwnerProfile(authData.user.id);
  if (!profile || profile.role !== 'owner') {
    return respond(403, { error: 'Forbidden: owner role required.' });
  }

  // Payload validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return respond(400, { error: 'Invalid action. Must be one of: approve, reject, reinstate, suspend.' });
  }

  const { action } = parsed.data;
  const { id: companyId } = await params;

  const statusMap: Record<string, string> = {
    approve: 'active',
    reject: 'rejected',
    reinstate: 'active',
    suspend: 'suspended',
  };

  const newStatus = statusMap[action];

  const { error: updateError } = await supabaseAdmin
    .from('companies')
    .update({ status: newStatus })
    .eq('id', companyId);

  if (updateError) {
    return respond(500, { error: updateError.message });
  }

  return respond(200, { success: true, companyId, newStatus });
}
