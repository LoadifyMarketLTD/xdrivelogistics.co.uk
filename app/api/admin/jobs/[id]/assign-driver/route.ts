import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../_lib/supabaseAdmin';

const bodySchema = z.object({
  driverId: z.string().uuid().nullable(),
  expectedDriverId: z.string().uuid().nullable().optional(),
});

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized: invalid or expired token.' });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return respond(400, { error: 'Invalid driver assignment payload.' });

  const { id: jobId } = await params;
  const { data, error } = await supabaseAdmin.rpc('assign_job_driver_atomic', {
    p_job_id: jobId,
    p_driver_id: parsed.data.driverId,
    p_expected_assigned_driver_id: parsed.data.expectedDriverId ?? null,
    p_actor_user_id: authData.user.id,
  });

  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '40001' ? 409 : error.code === 'P0002' ? 404 : 500;
    return respond(status, { error: error.message });
  }

  return respond(200, {
    success: true,
    job: Array.isArray(data) ? data[0] : data,
  });
}
