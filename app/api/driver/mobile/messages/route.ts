import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

/**
 * GET /api/driver/mobile/messages
 * Returns dispatcher messages for the authenticated driver.
 *
 * Architecture: reads from the `notifications` user inbox (read_at for read state),
 * enriched with entity/job routing from the corresponding `notification_events` row
 * (same id — set by the bridge trigger). Never writes to or reads read state from
 * `notification_events.status`.
 *
 * Cursor contract: `before` (ISO timestamp) + `before_id` (UUID) form a
 * two-field exclusive cursor on (created_at DESC, id DESC). Both fields must be
 * valid; mismatched or malformed values are rejected with 400.
 *
 * Query params:
 *   before      – ISO 8601 timestamp of the last row on the previous page
 *   before_id   – UUID of the last row on the previous page (used with before)
 *   limit       – page size, finite integer clamped to 1..200, default 50
 *
 * Response: { messages: Message[], unread_count: number }
 *   unread_count is the driver's total unread count (read_at IS NULL),
 *   independent of the current page.
 */

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidISOTimestamp(s: string): boolean {
  return ISO_TIMESTAMP_RE.test(s) && !isNaN(new Date(s).getTime());
}

function isValidUUID(s: string): boolean {
  return UUID_RE.test(s);
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });

  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { searchParams } = new URL(request.url);
  const before = searchParams.get('before');
  const beforeId = searchParams.get('before_id');
  const limitParam = searchParams.get('limit');

  // Validate cursor: before must be a valid ISO timestamp when present.
  if (before !== null && !isValidISOTimestamp(before)) {
    return respond(400, { error: 'Invalid cursor: before must be a valid ISO 8601 timestamp.' });
  }
  // Validate cursor: before_id must be a valid UUID when present.
  if (beforeId !== null && !isValidUUID(beforeId)) {
    return respond(400, { error: 'Invalid cursor: before_id must be a valid UUID.' });
  }
  // Validate cursor: before_id without before is a mismatched cursor.
  if (beforeId !== null && before === null) {
    return respond(400, { error: 'Invalid cursor: before_id requires before to be set.' });
  }

  // Validate limit: must be a finite integer in 1..200 when present.
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return respond(400, { error: 'Invalid limit: must be a finite integer.' });
    }
  }
  const rawLimit = limitParam !== null ? Number(limitParam) : 50;
  const limit = Math.max(1, Math.min(rawLimit || 50, 200));

  // ── Page query ──────────────────────────────────────────────────────────────
  // Read from notifications (user inbox). Order by (created_at DESC, id DESC)
  // for stable deterministic ordering.
  let notifQuery = supabaseAdmin
    .from('notifications')
    .select('id,type,title,body,read_at,created_at')
    .eq('user_id', driver.userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  // Two-field exclusive cursor: (created_at, id) < (before, before_id).
  // Both values have been validated above before interpolation.
  if (before && beforeId) {
    notifQuery = notifQuery.or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`);
  } else if (before) {
    notifQuery = notifQuery.lt('created_at', before);
  }

  const { data: notifData, error: notifError } = await notifQuery;
  if (notifError) return respond(500, { error: notifError.message });
  const notifRows = (notifData ?? []) as Array<Record<string, unknown>>;

  // ── Enrichment: entity/job routing from notification_events ─────────────────
  // notification_events shares the same id as notifications (bridge trigger).
  // Fetch entity_type, entity_id, payload for job routing only.
  const rowIds = notifRows.map((r) => String(r.id));
  const eventsMap: Record<string, Record<string, unknown>> = {};
  if (rowIds.length > 0) {
    const { data: evData } = await supabaseAdmin
      .from('notification_events')
      .select('id,entity_type,entity_id,payload')
      .in('id', rowIds);
    if (evData) {
      for (const ev of evData as Array<Record<string, unknown>>) {
        eventsMap[String(ev.id)] = ev;
      }
    }
  }

  // ── Total unread count ──────────────────────────────────────────────────────
  // Fetched independently of the page so the client always receives the true
  // owner-scoped unread count (read_at IS NULL), not derived from the page.
  const { count: totalUnread, error: countError } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', driver.userId)
    .is('read_at', null);
  if (countError) return respond(500, { error: countError.message });
  const unreadCount = totalUnread ?? 0;

  // ── Row mapping ─────────────────────────────────────────────────────────────
  const messages = notifRows.map((row) => {
    const ev = eventsMap[String(row.id)] ?? {};
    const payload = ev.payload && typeof ev.payload === 'object' ? ev.payload as Record<string, unknown> : {};

    // Resolve job routing: prefer entity_type/entity_id, fall back to payload.
    const entityType = typeof ev.entity_type === 'string' ? ev.entity_type : null;
    const entityId = ev.entity_id != null ? String(ev.entity_id) : null;
    const jobId = entityType === 'job' && entityId
      ? entityId
      : (typeof payload.job_id === 'string' ? payload.job_id : null);
    const jobRef = jobId ? `XDL-${jobId.slice(0, 8).toUpperCase()}` : null;

    // text: prefer body (human-readable), fall back to title.
    const text = typeof row.body === 'string' && row.body
      ? row.body
      : (typeof row.title === 'string' ? row.title : null);

    const isRead = row.read_at != null;

    return {
      id: String(row.id ?? ''),
      event_type: String(row.type ?? ''),
      entity_id: entityId,
      text,
      job_id: jobId,
      job_ref: jobRef,
      status: isRead ? 'read' : 'pending',
      created_at: String(row.created_at ?? ''),
      read: isRead,
    };
  });

  return respond(200, { messages, unread_count: unreadCount });
}

/**
 * POST /api/driver/mobile/messages
 * Mark one or all messages as read by setting notifications.read_at = now().
 *
 * Body: { id: string } — marks one notification read (idempotent: already-read rows
 *   are unaffected and the authoritative unread_count is still returned).
 * Body: {}             — marks all unread notifications read.
 *
 * Response: { ok: true, message: { id, read } | null, unread_count: number }
 *   message is the updated row for mark-one (null for mark-all).
 *   unread_count is the authoritative total after the update.
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

  // Validate messageId is a UUID when present.
  if (messageId !== null && !isValidUUID(messageId)) {
    return respond(400, { error: 'Invalid message id: must be a valid UUID.' });
  }

  const now = new Date().toISOString();

  if (messageId) {
    // Mark one message read — update notifications.read_at only for this owner's row.
    // Using update().eq('read_at', null) for idempotency: already-read rows skip the update
    // without error, and the authoritative unread_count is returned regardless.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('id', messageId)
      .eq('user_id', driver.userId)
      .select('id,read_at')
      .maybeSingle();
    if (updateError) return respond(500, { error: updateError.message });

    // Authoritative total unread count after the update.
    const { count: totalUnread, error: countError } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', driver.userId)
      .is('read_at', null);
    if (countError) return respond(500, { error: countError.message });

    return respond(200, {
      ok: true,
      message: updated
        ? { id: String(updated.id), read: updated.read_at != null }
        : null,
      unread_count: totalUnread ?? 0,
    });
  } else {
    // Mark all unread messages read for this owner.
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', driver.userId)
      .is('read_at', null);
    if (updateError) return respond(500, { error: updateError.message });

    return respond(200, { ok: true, message: null, unread_count: 0 });
  }
}

