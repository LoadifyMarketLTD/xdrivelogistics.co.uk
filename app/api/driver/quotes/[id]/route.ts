import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';

const respond = (status: number, payload: Record<string, unknown>) => NextResponse.json(payload, { status });

type BidRow = {
  id: string;
  job_id: string;
  bidder_user_id: string | null;
  company_id: string | null;
  status: string;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Server auth is not configured.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validatorClient = supabaseValidator ?? supabaseAdmin;
  const { data: authData, error: authError } = await validatorClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(401, { error: 'Unauthorized: invalid or expired token.' });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  if (body.action !== 'withdraw') {
    return respond(400, { error: 'Invalid quote action.' });
  }

  const { id } = await params;
  const { data: bidData, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, bidder_user_id, company_id, status')
    .eq('id', id)
    .maybeSingle();

  if (bidError) return respond(500, { error: bidError.message });
  if (!bidData) return respond(404, { error: 'Quote not found.' });

  const bid = bidData as BidRow;
  let authorised = bid.bidder_user_id === authData.user.id;

  if (!authorised && bid.company_id) {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('company_id', bid.company_id)
      .eq('status', 'active')
      .in('role_in_company', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();

    if (membershipError) return respond(500, { error: membershipError.message });
    authorised = Boolean(membership?.id);
  }

  if (!authorised) return respond(403, { error: 'You cannot modify this quote.' });

  if (bid.status !== 'submitted') {
    return respond(409, {
      error: bid.status === 'accepted'
        ? 'An accepted quote cannot be withdrawn.'
        : `Only submitted quotes can be withdrawn. Current status: ${bid.status}.`,
    });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('job_bids')
    .update({ status: 'withdrawn' })
    .eq('id', bid.id)
    .eq('status', 'submitted')
    .select('id, job_id, status')
    .maybeSingle();

  if (updateError) return respond(500, { error: updateError.message });
  if (!updated) return respond(409, { error: 'The quote changed before it could be withdrawn. Refresh and try again.' });

  const occurredAt = new Date().toISOString();
  const { error: notificationError } = await supabaseAdmin
    .from('notification_events')
    .insert({
      event_type: 'quote_withdrawn',
      entity_type: 'job_bid',
      entity_id: bid.id,
      recipient_user_id: authData.user.id,
      idempotency_key: `quote-withdrawn:${bid.id}`,
      payload: {
        bid_id: bid.id,
        job_id: bid.job_id,
        withdrawn_at: occurredAt,
      },
    });

  if (notificationError && notificationError.code !== '23505') {
    console.error('[driver/quotes] failed to record withdrawal notification', {
      bidId: bid.id,
      error: notificationError.message,
    });
  }

  return respond(200, {
    success: true,
    quoteId: updated.id,
    jobId: updated.job_id,
    status: updated.status,
  });
}
