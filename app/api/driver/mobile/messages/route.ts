import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

/**
 * GET /api/driver/mobile/messages
 * Returns dispatcher messages for the authenticated driver.
 *
 * Cursor contract: `before` (ISO timestamp) + `before_id` (UUID) form a
 * two-field exclusive cursor on (created_at DESC, id DESC).  Using both fields
 * guarantees lossless pagination even when multiple rows share the same
 * created_at timestamp.
 *
 * Query params:
 *   before      – ISO timestamp of the last row on the previous page
 *   before_id   – UUID of the last row on the previous page (used with before)
 *   limit       – page size (clamped to 1..200, default 50)
 *
 * Response: { messages: Message[], unread_count: number }
 *   unread_count is the driver's total unread count, independent of the page.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const before = searchParams.get('before');
  const beforeId = searchParams.get('before_id');
  // Clamp limit to 1..200, default 50.
  const rawLimit = Number(searchParams.get('limit') ?? 50) || 50;
  const limit = Math.max(1, Math.min(rawLimit, 200));

  // ── Page query ──────────────────────────────────────────────────────────────
  // Order by (created_at DESC, id DESC) for stable deterministic ordering.
  let query = supabaseAdmin
    .from('notification_events')
    .select('id,event_type,entity_type,entity_id,payload,status,created_at')
    .eq('recipient_user_id', driver.userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  // Two-field exclusive cursor: (created_at, id) < (before, before_id).
  // When both are supplied, use the precise compound filter to avoid skipping
  // rows that share the same created_at as the cursor row.
  if (before && beforeId) {
    query = query.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);
  } else if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) return respond(500, { error: error.message });

  // ── Total unread count ──────────────────────────────────────────────────────
  // Fetched independently of the page so the client always receives the true
  // owner-scoped unread count, not just the count of unread rows on this page.
  const { count: totalUnread, error: countError } = await supabaseAdmin
    .from('notification_events')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_user_id', driver.userId)
    .neq('status', 'read');
  if (countError) return respond(500, { error: countError.message });
  const unreadCount = totalUnread ?? 0;

  // ── Row mapping ─────────────────────────────────────────────────────────────
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const messages = rows.map((row) => {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : {};

    const text = typeof payload.message === 'string' ? payload.message
      : typeof payload.note === 'string' ? payload.note
      : typeof payload.body === 'string' ? payload.body
      : null;

    // Resolve job routing: prefer entity_type/entity_id, fall back to payload.
    const entityType = typeof row.entity_type === 'string' ? row.entity_type : null;
    const entityId = row.entity_id != null ? String(row.entity_id) : null;
    const jobId = entityType === 'job' && entityId
      ? entityId
      : (typeof payload.job_id === 'string' ? payload.job_id : null);
    const jobRef = jobId ? `XDL-${jobId.slice(0, 8).toUpperCase()}` : null;

    return {
      id: String(row.id ?? ''),
      event_type: String(row.event_type ?? ''),
      entity_id: entityId,
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
 * POST /api/driver/mobile/messages
 * Mark one or all messages as read.
 * Body: { id: string } — marks one message read.
 * Body: {}             — marks all messages read.
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

