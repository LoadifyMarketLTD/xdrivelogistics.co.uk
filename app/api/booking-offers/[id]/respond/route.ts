import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };
const bodySchema = z.object({ action: z.enum(['accept', 'decline']), reason: z.string().trim().max(1000).optional() });
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return json(503, { error: 'Service not available.' });
  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: { user }, error } = await validator.auth.getUser(token);
  if (error || !user) return json(401, { error: 'Unauthorized.' });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json(400, { error: 'Invalid booking-offer response.' });
  const { id } = await params;

  const rpc = parsed.data.action === 'accept' ? 'accept_job_booking_offer_atomic' : 'decline_job_booking_offer_atomic';
  const args = parsed.data.action === 'accept'
    ? { p_offer_id: id, p_actor_user_id: user.id }
    : { p_offer_id: id, p_actor_user_id: user.id, p_reason: parsed.data.reason ?? null };
  const { data, error: rpcError } = await supabaseAdmin.rpc(rpc, args);
  if (rpcError) return json(rpcError.code === '42501' ? 403 : rpcError.code === '23514' ? 409 : 500, { error: rpcError.message });
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.success) return json(result?.http_status ?? 500, { error: result?.error_message ?? 'Booking response failed.', code: result?.error_code });
  return json(200, result as Record<string, unknown>);
}
