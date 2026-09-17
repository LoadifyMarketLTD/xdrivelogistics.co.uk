import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../_lib/supabaseAdmin';

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
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Notifications are temporarily unavailable.' });
  }
  const user = await requireUser(request);
  if (!user) return respond(401, { error: 'Unauthorized.' });

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) return respond(500, { error: 'Notifications could not be loaded.' });
  return respond(200, { notifications: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Notifications are temporarily unavailable.' });
  }
  const user = await requireUser(request);
  if (!user) return respond(401, { error: 'Unauthorized.' });

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== 'read_all') return respond(400, { error: 'Unsupported notification action.' });

  const readAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return respond(500, { error: 'Unread notifications could not be marked as read.' });
  return respond(200, { success: true, readAt });
}
