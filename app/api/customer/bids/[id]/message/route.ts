import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };

const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return json(503, { error: 'Messages are temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return json(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validator.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return json(401, { error: 'Unauthorized.' });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!body) return json(400, { error: 'Message body is required.' });
  if (body.length > 4000) return json(400, { error: 'Message body must be 4,000 characters or fewer.' });

  const { id: bidId } = await params;
  const { data: bid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, bidder_user_id, status')
    .eq('id', bidId)
    .maybeSingle();

  if (bidError) return json(500, { error: 'Quote participant could not be verified.' });
  if (!bid) return json(404, { error: 'Quote not found.' });

  const bidStatus = String(bid.status ?? '').toLowerCase();
  if (!['submitted', 'accepted'].includes(bidStatus)) {
    return json(409, { error: 'Messaging is available only for an active or accepted quote.' });
  }

  const recipientUserId = typeof bid.bidder_user_id === 'string' ? bid.bidder_user_id : '';
  if (!recipientUserId || recipientUserId === user.id) {
    return json(409, { error: 'A verified quote participant is required for messaging.' });
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id, company_id')
    .eq('id', bid.job_id as string)
    .maybeSingle();

  if (jobError) return json(500, { error: 'Load ownership could not be verified.' });
  if (!job) return json(404, { error: 'Load not found.' });

  // Same commercial authority boundary used by Customer Award: only an active
  // owner/admin/dispatcher of the job-owning company may initiate contact from
  // a quote. Recipient identity is derived server-side from the real bid.
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('company_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('company_id', job.company_id as string)
    .eq('status', 'active')
    .in('role_in_company', ['owner', 'admin', 'dispatcher'])
    .maybeSingle();

  if (membershipError) return json(500, { error: 'Messaging permission could not be verified.' });
  if (!membership) {
    return json(403, { error: 'An active owner, admin or dispatcher of the load-owning company is required to message a bidder.' });
  }

  // Cross-company Messenger threads deliberately use company_id = NULL. This
  // preserves the existing messages_insert_sender policy for both parties:
  // each participant may reply as themselves without being falsely required to
  // join the other participant's company. Access remains participant-scoped by
  // sender_user_id / recipient_user_id.
  const { data: priorRows, error: priorError } = await supabaseAdmin
    .from('messages')
    .select('conversation_id, sender_user_id, recipient_user_id, created_at')
    .is('company_id', null)
    .or(`and(sender_user_id.eq.${user.id},recipient_user_id.eq.${recipientUserId}),and(sender_user_id.eq.${recipientUserId},recipient_user_id.eq.${user.id})`)
    .not('conversation_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (priorError) return json(500, { error: 'Existing conversation could not be verified.' });
  const priorConversationId = typeof priorRows?.[0]?.conversation_id === 'string'
    ? priorRows[0].conversation_id
    : null;
  const conversationId = priorConversationId ?? randomUUID();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert({
      company_id: null,
      conversation_id: conversationId,
      sender_user_id: user.id,
      recipient_user_id: recipientUserId,
      body,
    })
    .select('id, conversation_id, created_at')
    .single();

  if (insertError) return json(500, { error: 'Message could not be sent.' });

  return json(201, {
    success: true,
    messageId: inserted.id,
    conversationId: inserted.conversation_id,
    createdAt: inserted.created_at,
  });
}
