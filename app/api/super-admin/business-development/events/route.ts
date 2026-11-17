import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { hasSuperAdminBearerAuthorization, verifyPlatformOwner } from '../../_lib/verifyPlatformOwner';

import { crmIsolatedWriteEnabled } from '../_lib/server';

export const dynamic = 'force-dynamic';
const respond = (status: number, payload: Record<string, unknown>) =>
  NextResponse.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const eventTypes = new Set(['research_completed','qualified','call_attempted','meeting_scheduled','reply_received','onboarding_started','disqualified','note']);
const channels = new Set(['email','phone','other']);

async function authorize(request: NextRequest) {
  if (!isSupabaseAdminConfigured || !supabaseAdmin) return { error: respond(503, { error: 'CRM storage unavailable.' }) };
  if (!hasSuperAdminBearerAuthorization(request)) return { error: respond(401, { error: 'Authentication required.' }) };
  if (request.method !== 'GET' && !crmIsolatedWriteEnabled()) return { error: respond(403, { error: 'CRM writes require isolated staging.' }) };
  const owner = await verifyPlatformOwner(request);
  if (!owner) return { error: respond(403, { error: 'Active Platform Owner required or preview write disabled.' }) };
  return { owner };
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const organisationId = request.nextUrl.searchParams.get('organisation_id');
  if (!uuid(organisationId)) return respond(400, { error: 'Valid organisation_id required.' });
  const { data, error } = await supabaseAdmin!.from('crm_prospect_events')
    .select('id,organisation_id,contact_id,channel,event_type,occurred_at,note')
    .eq('organisation_id', organisationId).order('occurred_at', { ascending: false }).limit(100);
  if (error) return respond(503, { error: 'CRM activity unavailable.' });
  return respond(200, { events: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid');
    body = value as Record<string, unknown>;
  } catch { return respond(400, { error: 'Invalid JSON object.' }); }
  const eventType = String(body.event_type ?? '');
  const channel = String(body.channel ?? 'other');
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (!uuid(body.organisation_id) || !eventTypes.has(eventType) || !channels.has(channel) ||
      (body.contact_id != null && !uuid(body.contact_id)) || note.length > 2000)
    return respond(400, { error: 'Invalid activity fields.' });
  if (body.contact_id) {
    const { data: contact, error: contactError } = await supabaseAdmin!.from('crm_prospect_contacts')
      .select('id').eq('id', body.contact_id).eq('organisation_id', body.organisation_id).maybeSingle();
    if (contactError) return respond(503, { error: 'Contact relationship unavailable.' });
    if (!contact) return respond(400, { error: 'Contact does not belong to organisation.' });
  }
  // Record historical facts only. No email, phone call or campaign is initiated.
  const { data, error } = await supabaseAdmin!.from('crm_prospect_events').insert({
    organisation_id: body.organisation_id, contact_id: body.contact_id ?? null,
    channel, event_type: eventType, note: note || null, actor_user_id: auth.owner!.id,
  }).select('id,organisation_id,event_type,occurred_at').single();
  if (error) return respond(503, { error: 'CRM activity could not be saved.' });
  return respond(201, { event: data });
}
