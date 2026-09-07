import { NextRequest, NextResponse } from 'next/server';

import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';
import { counterpartIds, loadMessageContextMap, loadParticipantIdentityMap, type MessageRow } from '../../_lib/messageContext';
import { isWebDriverContext, requireActiveWebDriver } from '../_lib/webDriverContext';

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const identities = await loadParticipantIdentityMap(supabaseAdmin, allCounterpartIds);
  const conversationIds = rows.map((row) => row.conversation_id).filter((value): value is string => Boolean(value));
  const { contexts, partial: contextPartial } = await loadMessageContextMap(supabaseAdmin, conversationIds);
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
    const identity = singleCounterpart ? identities.get(singleCounterpart) ?? null : null;
    const context = latest?.conversation_id ? contexts.get(latest.conversation_id) ?? null : null;
    return {
      key,
      conversationId: latest?.conversation_id ?? null,
      counterpartUserId: singleCounterpart,
      counterpartName: singleCounterpart
        ? identity?.name ?? identity?.companyName ?? `Member #${singleCounterpart.slice(0, 8).toUpperCase()}`
        : counterparts.length > 1
          ? 'Multiple participants'
          : 'Participant unavailable',
      counterpartCompanyId: identity?.companyId ?? null,
      counterpartCompanyName: identity?.companyName ?? null,
      context,
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
    contextPartial,
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

  const companyId = companyIds[0] ?? null;
  if (companyId) {
    // Reproduce the existing messages_insert_sender RLS contract even though
    // this route uses service role after bearer authentication.
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', driver.userId)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) return json(500, { error: 'Conversation company access could not be verified.' });
    if (!membership) return json(403, { error: 'Active company membership is required to reply in this conversation.' });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert({
      company_id: companyId,
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
