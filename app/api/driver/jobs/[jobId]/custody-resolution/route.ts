import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../../_lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
const dispositions = new Set(['return_to_collection','return_to_sender_depot','redirect_authorised','replacement_stop']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is unavailable.' });
  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Authentication required.' });
  const { data: auth, error: authError } = await (supabaseValidator ?? supabaseAdmin).auth.getUser(token);
  if (authError || !auth.user) return respond(401, { error: 'Authentication required.' });
  const { jobId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return respond(400, { error: 'Invalid request.' });
  const stopId = typeof body.stop_id === 'string' ? body.stop_id.trim() : '';
  const disposition = typeof body.disposition === 'string' ? body.disposition.trim() : '';
  const destination = typeof body.destination === 'string' ? body.destination.trim().slice(0, 500) : '';
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim().slice(0, 2000) : '';
  if (!stopId || !dispositions.has(disposition) || !destination || instruction.length < 5) {
    return respond(400, { error: 'Stop, authorised disposition, destination and instruction are required.' });
  }
  // Permission and concurrency checks are enforced inside the SECURITY DEFINER transaction.
  const { data, error } = await supabaseAdmin.rpc('resolve_driver_goods_custody_atomic', {
    p_job_id: jobId, p_stop_id: stopId, p_actor_user_id: auth.user.id,
    p_disposition: disposition, p_destination: destination, p_instruction: instruction,
  });
  if (error) return respond(error.code === '42501' ? 403 : 409, { error: error.message || 'Custody could not be resolved.' });
  return respond(200, { ok: true, result: data });
}
