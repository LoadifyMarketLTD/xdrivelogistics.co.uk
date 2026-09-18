import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const respond = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

async function authenticatedUser(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return { error: respond(503, { error: 'Notifications are temporarily unavailable.' }) };
  }

  const token = getBearerToken(request);
  if (!token) return { error: respond(401, { error: 'Unauthorized.' }) };

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { error: respond(401, { error: 'Unauthorized.' }) };

  return { user: data.user };
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if ('error' in auth) return auth.error;

  const user = auth.user;
  const mode = request.nextUrl.searchParams.get('mode');

  if (mode === 'count') {
    const { count, error } = await supabaseAdmin!
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .is('read_at', null);

    if (error) return respond(500, { error: 'Unable to count notifications.' });
    return respond(200, { unreadCount: count ?? 0 });
  }

  const { data, error } = await supabaseAdmin!
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) return respond(500, { error: 'Notifications could not be loaded.' });
  return respond(200, { notifications: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if ('error' in auth) return auth.error;

  const user = auth.user;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    id?: string;
    all?: boolean;
  } | null;

  if (body?.action !== 'read_all' && body?.all !== true && !body?.id) {
    return respond(400, { error: 'Unsupported notification action.' });
  }

  const readAt = new Date().toISOString();
  let query = supabaseAdmin!
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', user.id);

  if (body?.action === 'read_all' || body?.all === true) {
    query = query.is('read_at', null);
  } else if (body?.id) {
    query = query.eq('id', body.id);
  }

  const { error } = await query;
  if (error) return respond(500, { error: 'Notification state could not be updated.' });

  return respond(200, { success: true, readAt });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if ('error' in auth) return auth.error;

  const user = auth.user;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return respond(400, { error: 'Notification id is required.' });

  const { error } = await supabaseAdmin!
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return respond(500, { error: 'This notification could not be removed.' });
  return respond(200, { removed: true });
}
