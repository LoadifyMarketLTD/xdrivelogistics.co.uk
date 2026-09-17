import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

async function requireUser(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return null;
  const token = getBearerToken(request);
  if (!token) return null;
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Notifications are temporarily unavailable.' });
  }
  const user = await requireUser(request);
  if (!user) return respond(401, { error: 'Unauthorized.' });
  const { id } = await params;
  const readAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: readAt })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return respond(500, { error: 'This notification could not be marked as read.' });
  if (!data) return respond(404, { error: 'Notification not found.' });
  return respond(200, { success: true, readAt });
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Notifications are temporarily unavailable.' });
  }
  const user = await requireUser(request);
  if (!user) return respond(401, { error: 'Unauthorized.' });
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return respond(500, { error: 'This notification could not be removed.' });
  if (!data) return respond(404, { error: 'Notification not found.' });
  return respond(200, { success: true });
}
