import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getBearerToken,
  isSupabaseAdminConfigured,
  supabaseAdmin,
  supabaseValidator,
} from '../../../_lib/supabaseAdmin';

type Params = { params: Promise<{ id: string }> };

const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } });

const schema = z.object({
  action: z.enum([
    'viewed',
    'shortlist',
    'unshortlist',
    'archive_poster',
    'unarchive_poster',
    'archive_bidder',
    'unarchive_bidder',
  ]),
});

const POSTER_ROLES = new Set(['owner', 'admin', 'dispatcher']);

export async function POST(request: NextRequest, { params }: Params) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) {
    return respond(503, { error: 'Quote lifecycle service is temporarily unavailable.' });
  }

  const token = getBearerToken(request);
  if (!token) return respond(401, { error: 'Unauthorized.' });

  const validator = supabaseValidator ?? supabaseAdmin;
  const { data: auth, error: authError } = await validator.auth.getUser(token);
  if (authError || !auth.user) return respond(401, { error: 'Invalid session.' });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond(400, { error: 'Invalid quote lifecycle action.' });

  const { id } = await params;
  const bidId = id?.trim();
  if (!bidId) return respond(400, { error: 'Quote id is required.' });

  const { data: bid, error: bidError } = await supabaseAdmin
    .from('job_bids')
    .select('id, job_id, company_id, bidder_user_id, status, viewed_at, shortlisted_at, poster_archived_at, bidder_archived_at, jobs!inner(company_id)')
    .eq('id', bidId)
    .maybeSingle();

  if (bidError) return respond(500, { error: 'Quote could not be loaded.' });
  if (!bid) return respond(404, { error: 'Quote not found.' });

  const jobRelation = Array.isArray(bid.jobs) ? bid.jobs[0] : bid.jobs;
  const posterCompanyId = String((jobRelation as { company_id?: string | null } | null)?.company_id ?? '');
  const bidderCompanyId = String(bid.company_id ?? '');
  const action = parsed.data.action;
  const posterAction = ['viewed', 'shortlist', 'unshortlist', 'archive_poster', 'unarchive_poster'].includes(action);
  const bidderAction = ['archive_bidder', 'unarchive_bidder'].includes(action);

  if (posterAction) {
    if (!posterCompanyId) return respond(409, { error: 'The job-owning company could not be resolved.' });
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .select('role_in_company')
      .eq('company_id', posterCompanyId)
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) return respond(503, { error: 'Quote authority could not be verified.' });
    if (!POSTER_ROLES.has(String(membership?.role_in_company ?? '').toLowerCase())) {
      return respond(403, { error: 'This role cannot manage the received quote lifecycle.' });
    }
  }

  if (bidderAction) {
    const ownsPersonalQuote = String(bid.bidder_user_id ?? '') === auth.user.id;
    let companyAuthority = false;
    if (!ownsPersonalQuote && bidderCompanyId) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('company_memberships')
        .select('id')
        .eq('company_id', bidderCompanyId)
        .eq('user_id', auth.user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (membershipError) return respond(503, { error: 'Quote ownership could not be verified.' });
      companyAuthority = Boolean(membership?.id);
    }
    if (!ownsPersonalQuote && !companyAuthority) {
      return respond(403, { error: 'You cannot archive this submitted quote.' });
    }
  }

  const baseStatus = String(bid.status ?? '').trim().toLowerCase();
  if (['viewed', 'shortlist', 'unshortlist'].includes(action) && baseStatus !== 'submitted') {
    return respond(409, { error: 'Only active submitted quotes can be viewed or shortlisted.' });
  }

  const now = new Date().toISOString();
  const update: Record<string, string | null> = {};
  let eventType = '';

  if (action === 'viewed') {
    if (!bid.viewed_at) update.viewed_at = now;
    eventType = 'quote_viewed';
  } else if (action === 'shortlist') {
    update.viewed_at = bid.viewed_at ?? now;
    update.shortlisted_at = now;
    eventType = 'quote_shortlisted';
  } else if (action === 'unshortlist') {
    update.shortlisted_at = null;
    eventType = 'quote_unshortlisted';
  } else if (action === 'archive_poster') {
    update.poster_archived_at = now;
    eventType = 'quote_archived_by_poster';
  } else if (action === 'unarchive_poster') {
    update.poster_archived_at = null;
    eventType = 'quote_unarchived_by_poster';
  } else if (action === 'archive_bidder') {
    update.bidder_archived_at = now;
    eventType = 'quote_archived_by_bidder';
  } else {
    update.bidder_archived_at = null;
    eventType = 'quote_unarchived_by_bidder';
  }

  let updated = bid;
  if (Object.keys(update).length) {
    const { data, error } = await supabaseAdmin
      .from('job_bids')
      .update(update)
      .eq('id', bidId)
      .select('id, job_id, company_id, bidder_user_id, status, viewed_at, shortlisted_at, poster_archived_at, bidder_archived_at')
      .single();
    if (error) return respond(500, { error: 'Quote lifecycle could not be updated.' });
    updated = { ...bid, ...data };
  }

  const { error: auditError } = await supabaseAdmin.from('job_tracking_events').insert({
    job_id: bid.job_id,
    event_type: eventType,
    event_time: now,
    user_id: auth.user.id,
    created_by: auth.user.id,
    message: eventType.replaceAll('_', ' '),
    meta: { bid_id: bidId, action },
  });

  return respond(200, {
    success: true,
    bid: updated,
    auditWarning: auditError ? 'Quote updated, but its audit event could not be recorded.' : null,
  });
}
