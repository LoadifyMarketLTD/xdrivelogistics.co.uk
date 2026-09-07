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

  // Quote-origin conversations are deterministically scoped to this quote.
  // The bid UUID is itself the conversation UUID, so the thread can be linked
  // back to the exact commercial context without a second context table.
  const conversationId = String(bid.id);

  const { data: existingContextRows, error: existingContextError } = await supabaseAdmin
    .from('messages')
    .select('sender_user_id, recipient_user_id')
    .eq('conversation_id', conversationId)
    .limit(50);
  if (existingContextError) return json(500, { error: 'Existing quote conversation could not be verified.' });
  for (const row of existingContextRows ?? []) {
    const participants = new Set([row.sender_user_id, row.recipient_user_id].filter(Boolean));
    if (participants.size && (!participants.has(user.id) || !participants.has(recipientUserId))) {
      return json(409, { error: 'Quote conversation context conflicts with its verified participants.' });
    }
  }

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
