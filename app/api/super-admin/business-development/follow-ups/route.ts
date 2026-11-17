import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmTrimmed, crmUuid } from '../_lib/server';

export const dynamic = 'force-dynamic';
const buckets = new Set(['overdue', 'today', 'next7', 'unscheduled', 'all']);
const activities = new Set([
  'research_completed', 'qualified', 'call_attempted', 'meeting_scheduled',
  'reply_received', 'onboarding_started', 'disqualified', 'note',
]);
const channels = new Set(['email', 'phone', 'other']);
const actionModes = new Set(['preserve', 'schedule', 'clear']);

export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  const query = request.nextUrl.searchParams;
  const bucket = query.get('bucket') ?? 'overdue';
  const page = Number(query.get('page') ?? '1');
  if (!buckets.has(bucket) || !Number.isSafeInteger(page) || page < 1 || page > 10000)
    return crmResponse(400, { error: 'Invalid queue or page.' });
  const now = new Date();
  let rows = supabaseAdmin!.from('crm_prospect_organisations')
    .select('id,legal_name,company_number,legal_form,segment,status,source_url,source_type,source_reference,priority,owner_user_id,next_follow_up_at,created_at,updated_at', { count: 'exact' })
    .not('status', 'in', '(converted,disqualified)');
  if (bucket === 'unscheduled') rows = rows.is('next_follow_up_at', null);
  else if (bucket !== 'all') {
    rows = rows.not('next_follow_up_at', 'is', null);
    if (bucket === 'overdue') rows = rows.lt('next_follow_up_at', now.toISOString());
    else if (bucket === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      rows = rows.gte('next_follow_up_at', start.toISOString())
        .lt('next_follow_up_at', end.toISOString());
    } else {
      const end = new Date(now); end.setDate(end.getDate() + 7);
      rows = rows.gte('next_follow_up_at', now.toISOString()).lte('next_follow_up_at', end.toISOString());
    }
  }
  const { data, count, error } = await rows
    .order('next_follow_up_at', { ascending: true, nullsFirst: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (error || count === null) return crmResponse(503, { error: 'Follow-up queue unavailable.' });
  return crmResponse(200, {
    bucket, page, total: count, page_size: 25, organisations: data ?? [],
    note: 'Queue contains owner-verified CRM records only. No background messages or marketing calls are sent.',
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCrm(request, true);
  if (auth.error) return auth.error;
  let body: Record<string, unknown>;
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid JSON');
    body = input as Record<string, unknown>;
  } catch { return crmResponse(400, { error: 'Valid JSON object required.' }); }

  const type = String(body.event_type ?? '');
  const channel = String(body.channel ?? 'other');
  const mode = String(body.follow_up_action ?? 'preserve');
  if (!crmUuid(body.organisation_id) || (body.contact_id != null && !crmUuid(body.contact_id)) ||
      !activities.has(type) || !channels.has(channel) || !actionModes.has(mode) ||
      !crmTrimmed(body.note, 2000) || (body.note as string).trim().length < 10)
    return crmResponse(400, { error: 'Valid organisation, activity, evidence and follow-up action required.' });

  const due = typeof body.next_follow_up_at === 'string' ? new Date(body.next_follow_up_at) : null;
  if (mode === 'schedule' && (!due || !Number.isFinite(due.getTime()) ||
      due.getTime() <= Date.now() || due.getUTCFullYear() > 2050))
    return crmResponse(400, { error: 'A future follow-up date is required.' });

  const { data, error } = await supabaseAdmin!.rpc('crm_record_prospect_action', {
    p_organisation_id: body.organisation_id,
    p_contact_id: body.contact_id ?? null,
    p_actor_id: auth.owner!.id,
    p_event_type: type,
    p_channel: channel,
    p_note: (body.note as string).trim(),
    p_follow_up_action: mode,
    p_next_follow_up_at: mode === 'schedule' ? due!.toISOString() : null,
  });
  if (error) return crmResponse(
    ['23503', '23514', 'P0001'].includes(error.code ?? '') ? 409 : 503,
    { error: 'Follow-up action rejected. Check stage, contact relationship, evidence and staging schema.' },
  );
  return crmResponse(200, { result: data, messages_sent: 0, automated_outreach: false });
}
