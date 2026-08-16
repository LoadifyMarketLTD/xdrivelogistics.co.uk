import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MessageRow = {
  id: string;
  company_id: string | null;
  conversation_id: string | null;
  sender_user_id: string | null;
  recipient_user_id: string | null;
  body: string;
  created_at: string | null;
};

function counterpartIds(messages: MessageRow[], userId: string) {
  const ids = new Set<string>();
  for (const message of messages) {
    if (message.sender_user_id === userId && message.recipient_user_id) ids.add(message.recipient_user_id);
    if (message.recipient_user_id === userId && message.sender_user_id) ids.add(message.sender_user_id);
  }
  ids.delete(userId);
  return [...ids];
}

async function participantNames(userIds: string[]) {
  const names = new Map<string, string>();
  if (!supabaseAdmin || userIds.length === 0) return names;

  const [profilesResult, driversResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id, full_name').in('user_id', userIds),
    supabaseAdmin.from('drivers').select('user_id, display_name').in('user_id', userIds),
  ]);

  if (!profilesResult.error) {
    for (const profile of profilesResult.data ?? []) {
      const userId = typeof profile.user_id === 'string' ? profile.user_id : '';
      const name = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
      if (userId && name) names.set(userId, name);
    }
  }
  if (!driversResult.error) {
    for (const driver of driversResult.data ?? []) {
      const userId = typeof driver.user_id === 'string' ? driver.user_id : '';
      const name = typeof driver.display_name === 'string' ? driver.display_name.trim() : '';
      if (userId && name && !names.has(userId)) names.set(userId, name);
    }
  }

  return names;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Messages are temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, company_id, conversation_id, sender_user_id, recipient_user_id, body, created_at')
    .or(`sender_user_id.eq.${driver.userId},recipient_user_id.eq.${driver.userId}`)
    .order('created_at', { ascending: false })
    .limit(250);

  if (error) return json(500, { error: 'Messages could not be loaded.' });

  const rows = (data ?? []) as MessageRow[];
  const allCounterpartIds = counterpartIds(rows, driver.userId);
  const names = await participantNames(allCounterpartIds);
  const groups = new Map<string, MessageRow[]>();

  for (const row of rows) {
    // Historical rows without a conversation id remain visible but are not
    // converted into a fabricated thread. They are immutable legacy records.
    const key = row.conversation_id || `legacy:${row.id}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const threads = [...groups.entries()].map(([key, group]) => {
    const messages = [...group].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    const counterparts = counterpartIds(messages, driver.userId);
    const latest = messages[messages.length - 1];
    const singleCounterpart = counterparts.length === 1 ? counterparts[0] : null;
    return {
      key,
      conversationId: latest?.conversation_id ?? null,
      counterpartUserId: singleCounterpart,
      counterpartName: singleCounterpart
        ? names.get(singleCounterpart) ?? `Member #${singleCounterpart.slice(0, 8).toUpperCase()}`
        : counterparts.length > 1
          ? 'Multiple participants'
          : 'Participant unavailable',
      canReply: Boolean(latest?.conversation_id && singleCounterpart),
      latestAt: latest?.created_at ?? null,
      latestBody: latest?.body ?? '',
      messages: messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.created_at,
        direction: message.sender_user_id === driver.userId ? 'outbound' : 'inbound',
        senderUserId: message.sender_user_id,
        recipientUserId: message.recipient_user_id,
      })),
    };
  }).sort((a, b) => new Date(b.latestAt ?? 0).getTime() - new Date(a.latestAt ?? 0).getTime());

  return json(200, {
    threads,
    readStateAvailable: false,
  });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Messages are temporarily unavailable.' });
  }

  const driver = await requireActiveWebDriver(request);
  if (!isWebDriverContext(driver)) return driver;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
  if (!UUID_RE.test(conversationId)) return json(400, { error: 'A valid existing conversation is required.' });
  if (!messageBody) return json(400, { error: 'Message body is required.' });
  if (messageBody.length > 4000) return json(400, { error: 'Message body must be 4,000 characters or fewer.' });

  // Service-role access is manually reduced to an existing conversation in
  // which the current user is already a participant. This endpoint cannot be
  // used to discover or contact an arbitrary user id.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('messages')
    .select('id, company_id, conversation_id, sender_user_id, recipient_user_id, body, created_at')
    .eq('conversation_id', conversationId)
    .or(`sender_user_id.eq.${driver.userId},recipient_user_id.eq.${driver.userId}`)
    .order('created_at', { ascending: false })
    .limit(250);

  if (existingError) return json(500, { error: 'Conversation could not be verified.' });
  const rows = (existing ?? []) as MessageRow[];
  if (rows.length === 0) return json(404, { error: 'Conversation not found for this account.' });

  const counterparts = counterpartIds(rows, driver.userId);
  if (counterparts.length !== 1) {
    return json(409, { error: 'Reply is unavailable because this conversation does not have one verified counterpart.' });
  }

  const companyIds = [...new Set(rows.map((row) => row.company_id).filter((value): value is string => Boolean(value)))];
  if (companyIds.length > 1) {
    return json(409, { error: 'Reply is unavailable because this conversation has inconsistent company context.' });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert({
      company_id: companyIds[0] ?? null,
      conversation_id: conversationId,
      sender_user_id: driver.userId,
      recipient_user_id: counterparts[0],
      body: messageBody,
    })
    .select('id, company_id, conversation_id, sender_user_id, recipient_user_id, body, created_at')
    .single();

  if (insertError) return json(500, { error: 'Message could not be sent.' });
  return json(201, { message: inserted });
}
