import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

/**
 * GET /api/driver/mobile/messages
 * Returns dispatcher messages for the authenticated driver.
 *
 * These are notification_events with event_type = 'dispatcher_message' or
 * any event that carries a message/note in its payload.  A cursor-based
 * `before` query param (ISO timestamp) enables pagination.
 *
 * Response: { messages: Message[], unread_count: number }
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const before = searchParams.get('before');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50) || 50, 200);

  let query = supabaseAdmin
    .from('notification_events')
    .select('id,event_type,entity_type,entity_id,payload,status,created_at')
    .eq('recipient_user_id', driver.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // Unread count: events whose status is not 'read'
  const unreadCount = rows.filter((row) => String(row.status ?? '').toLowerCase() !== 'read').length;

  const messages = rows.map((row) => {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {};
    const text = typeof payload.message === 'string' ? payload.message
      : typeof payload.note === 'string' ? payload.note
      : typeof payload.body === 'string' ? payload.body
      : null;
    const jobId = typeof payload.job_id === 'string' ? payload.job_id : null;
    const jobRef = jobId ? `XDL-${jobId.slice(0, 8).toUpperCase()}` : null;
    return {
      id: String(row.id ?? ''),
      event_type: String(row.event_type ?? ''),
      entity_id: typeof row.entity_id === 'string' ? row.entity_id : null,
      text,
      job_id: jobId,
      job_ref: jobRef,
      status: String(row.status ?? 'pending'),
      created_at: String(row.created_at ?? ''),
      read: String(row.status ?? '').toLowerCase() === 'read',
    };
  });

  return respond(200, { messages, unread_count: unreadCount });
}

/**
 * POST /api/driver/mobile/messages/read
 * Mark one or all messages as read.
 * Body: { id?: string } — omit id to mark all as read.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // empty body is fine — marks all as read
  }

  const messageId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;

  let query = supabaseAdmin
    .from('notification_events')
    .update({ status: 'read' })
    .eq('recipient_user_id', driver.userId);

  if (messageId) {
    query = query.eq('id', messageId);
  }

  const { error } = await query;
  if (error) return respond(500, { error: error.message });

  return respond(200, { ok: true });
}
