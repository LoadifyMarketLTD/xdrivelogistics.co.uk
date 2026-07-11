import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 50) || 50, 200);
  const unreadOnly = searchParams.get('unread') === 'true';

  let query = supabaseAdmin
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .eq('user_id', driver.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.is('read_at', null);

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  return respond(200, { notifications: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const body = await request.json().catch(() => ({})) as { ids?: string[]; markAll?: boolean };
  const now = new Date().toISOString();

  if (body.markAll) {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', driver.userId)
      .is('read_at', null);
    if (error) return respond(500, { error: error.message });
    return respond(200, { ok: true });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return respond(400, { error: 'Provide ids or markAll.' });
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', driver.userId)
    .in('id', body.ids);
  if (error) return respond(500, { error: error.message });

  return respond(200, { ok: true });
}
