import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../../_lib';

// ── GET /api/driver/mobile/messages/[id] ─────────────────────────────────────
// Returns messages within a conversation. Marks unread messages as read.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { id } = await params;

  // Verify the conversation belongs to this driver
  const { data: conv, error: convErr } = await supabaseAdmin
    .from('driver_conversations')
    .select('id, job_id, subject, created_at')
    .eq('id', id)
    .eq('driver_id', driver.driverId)
    .maybeSingle();

  if (convErr) return respond(500, { error: convErr.message });
  if (!conv) return respond(403, { error: 'Conversation not found.' });

  // Fetch messages in chronological order
  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('driver_messages')
    .select('id, body, sender_user_id, read_at, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (msgErr) return respond(500, { error: msgErr.message });

  // Mark unread messages not sent by this driver as read
  const unreadIds = ((messages ?? []) as Array<{ id: string; sender_user_id: string; read_at: string | null }>)
    .filter((m) => !m.read_at && m.sender_user_id !== driver.userId)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await supabaseAdmin
      .from('driver_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
  }

  return respond(200, {
    conversation: conv,
    messages: messages ?? [],
  });
}
