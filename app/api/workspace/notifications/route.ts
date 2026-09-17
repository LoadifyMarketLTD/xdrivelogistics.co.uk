import { NextRequest, NextResponse } from 'next/server';
import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../_lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

async function authenticatedUser(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: json(503, { error: 'Notification service is unavailable.' }) };
  const token = getBearerToken(request);
  if (!token) return { error: json(401, { error: 'Unauthorized.' }) };
  const validator = supabaseValidator ?? supabaseAdmin;
  const { data, error } = await validator.auth.getUser(token);
  if (error || !data.user) return { error: json(401, { error: 'Unauthorized.' }) };
  return { user: data.user };
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if ('error' in auth) return auth.error;
  const mode = request.nextUrl.searchParams.get('mode');
  if (mode === 'count') {
    const { count, error } = await supabaseAdmin!
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .is('read_at', null);
    if (error) return json(500, { error: 'Unable to count notifications.' });
    return json(200, { unreadCount: count ?? 0 });
  }

  const { data, error } = await supabaseAdmin!
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) return json(500, { error: 'Unable to load notifications.' });
  return json(200, { notifications: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean };
  const readAt = new Date().toISOString();
  let query = supabaseAdmin!.from('notifications').update({ read_at: readAt }).eq('user_id', auth.user.id);
  if (body.all === true) query = query.is('read_at', null);
  else if (body.id) query = query.eq('id', body.id);
  else return json(400, { error: 'Notification id is required.' });
  const { error } = await query;
  if (error) return json(500, { error: 'Unable to update notification.' });
  return json(200, { readAt });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if ('error' in auth) return auth.error;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return json(400, { error: 'Notification id is required.' });
  const { error } = await supabaseAdmin!.from('notifications').delete().eq('id', id).eq('user_id', auth.user.id);
  if (error) return json(500, { error: 'Unable to remove notification.' });
  return json(200, { removed: true });
}
