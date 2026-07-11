import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { isDriverContext, requireDriver, respond } from '../_lib';

// ── GET /api/driver/mobile/messages ──────────────────────────────────────────
// Returns the list of conversations for the authenticated driver,
// including the latest message preview and unread count.

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  const { data, error } = await supabaseAdmin
    .from('driver_conversations')
    .select('id, job_id, subject, created_at, updated_at')
    .eq('driver_id', driver.driverId)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return respond(500, { error: error.message });

  const conversations = data ?? [];

  // Attach latest message + unread count for each conversation
  const enriched = await Promise.all(
    conversations.map(async (conv) => {
      const [latestResult, unreadResult] = await Promise.all([
        supabaseAdmin!
          .from('driver_messages')
          .select('id, body, sender_user_id, created_at, read_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin!
          .from('driver_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .is('read_at', null)
          .neq('sender_user_id', driver.userId),
      ]);

      return {
        id: conv.id,
        jobId: conv.job_id ?? null,
        subject: conv.subject ?? null,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        latestMessage: latestResult.data ?? null,
        unreadCount: unreadResult.count ?? 0,
      };
    })
  );

  return respond(200, { conversations: enriched });
}

// ── POST /api/driver/mobile/messages ─────────────────────────────────────────
// Send a message. If no conversation exists for (driver, job) create one first.

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return respond(503, { error: 'Server auth is not configured.' });
  const driver = await requireDriver(request);
  if (!isDriverContext(driver)) return driver;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return respond(400, { error: 'Invalid JSON body.' });
  }

  const rawBody = typeof body.body === 'string' ? body.body.trim() : '';
  if (!rawBody || rawBody.length > 5000) return respond(400, { error: 'Message body must be 1–5000 characters.' });

  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : null;
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : null;

  let resolvedConvId: string;

  if (conversationId) {
    // Verify the conversation belongs to this driver
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('driver_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('driver_id', driver.driverId)
      .maybeSingle();

    if (fetchErr) return respond(500, { error: fetchErr.message });
    if (!existing) return respond(403, { error: 'Conversation not found.' });

    resolvedConvId = existing.id as string;
  } else {
    // Find or create a conversation for this driver + optional job
    let existing: { id: string } | null = null;

    if (jobId) {
      const { data } = await supabaseAdmin
        .from('driver_conversations')
        .select('id')
        .eq('driver_id', driver.driverId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = data as { id: string } | null;
    }

    if (!existing) {
      const { data: created, error: createErr } = await supabaseAdmin
        .from('driver_conversations')
        .insert({
          company_id: driver.companyId,
          driver_id: driver.driverId,
          job_id: jobId || null,
          subject: jobId ? `Job query` : 'General enquiry',
        })
        .select('id')
        .single();

      if (createErr || !created) return respond(500, { error: createErr?.message ?? 'Could not create conversation.' });
      existing = created as { id: string };
    }

    resolvedConvId = existing.id;
  }

  // Insert the message
  const { data: message, error: msgErr } = await supabaseAdmin
    .from('driver_messages')
    .insert({
      conversation_id: resolvedConvId,
      sender_user_id: driver.userId,
      body: rawBody,
    })
    .select('id, conversation_id, body, sender_user_id, read_at, created_at')
    .single();

  if (msgErr) return respond(500, { error: msgErr.message });

  // Bump conversation updated_at so it surfaces at the top of the list
  await supabaseAdmin
    .from('driver_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', resolvedConvId);

  return respond(200, { ok: true, message, conversationId: resolvedConvId });
}
