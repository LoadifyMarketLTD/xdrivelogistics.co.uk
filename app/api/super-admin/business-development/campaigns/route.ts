import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmTrimmed, crmUuid } from '../_lib/server';

export const dynamic = 'force-dynamic';
const segments = new Set(['customer','broker','forwarder','carrier','mixed']);
const channels = new Set(['email','phone']);

async function bodyFrom(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  const { data, error } = await supabaseAdmin!.from('crm_campaign_drafts')
    .select('id,name,segment,channel,subject,body,status,approval_evidence,created_at,updated_at,approved_at')
    .order('updated_at', { ascending: false }).limit(100);
  if (error) return crmResponse(503, { error: 'Campaign drafts unavailable.' });
  return crmResponse(200, { drafts: data ?? [], sending_enabled: false });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCrm(request, true);
  if (auth.error) return auth.error;
  const body = await bodyFrom(request);
  if (!body || !crmTrimmed(body.name, 160) || !segments.has(String(body.segment)) ||
      !channels.has(String(body.channel)) ||
      (body.channel === 'email' && !crmTrimmed(body.subject, 200)) ||
      !crmTrimmed(body.body, 6000))
    return crmResponse(400, { error: 'Name, audience, channel, subject and message required.' });
  const { data, error } = await supabaseAdmin!.from('crm_campaign_drafts').insert({
    name: (body.name as string).trim(), segment: body.segment, channel: body.channel,
    subject: typeof body.subject === 'string' ? body.subject.trim() : null,
    body: (body.body as string).trim(), created_by: auth.owner!.id, last_actor_id: auth.owner!.id,
    status: 'draft',
  }).select('id,name,status').single();
  if (error) return crmResponse(503, { error: 'Campaign draft creation failed.' });
  return crmResponse(201, { draft: data, sending_enabled: false });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeCrm(request, true);
  if (auth.error) return auth.error;
  const body = await bodyFrom(request);
  if (!body || !crmUuid(body.id) || !['edit','approve','archive','reopen'].includes(String(body.action)))
    return crmResponse(400, { error: 'Valid draft ID and action required.' });
  const { data: before, error: readError } = await supabaseAdmin!.from('crm_campaign_drafts')
    .select('id,status,channel').eq('id', body.id).maybeSingle();
  if (readError) return crmResponse(503, { error: 'Draft unavailable.' });
  if (!before) return crmResponse(404, { error: 'Draft not found.' });
  const patch: Record<string, unknown> = { last_actor_id: auth.owner!.id, updated_at: new Date().toISOString() };
  if (body.action === 'edit') {
    if (before.status !== 'draft') return crmResponse(409, { error: 'Reopen draft before editing.' });
    if (!crmTrimmed(body.name,160) || !crmTrimmed(body.body,6000) ||
        !segments.has(String(body.segment)) || !channels.has(String(body.channel)) ||
        (body.channel === 'email' && !crmTrimmed(body.subject,200)))
      return crmResponse(400, { error: 'Invalid draft details.' });
    Object.assign(patch, { name: (body.name as string).trim(), body: (body.body as string).trim(),
      segment: body.segment, channel: body.channel,
      subject: typeof body.subject === 'string' ? body.subject.trim() : null });
  } else if (body.action === 'approve') {
    if (before.status !== 'draft' || !crmTrimmed(body.approval_evidence, 2000) ||
        (body.approval_evidence as string).trim().length < 30)
      return crmResponse(400, { error: 'Draft approval requires at least 30 characters of documented legal review evidence.' });
    Object.assign(patch, { status: 'approved', approved_by: auth.owner!.id, approved_at: new Date().toISOString(),
      approval_evidence: (body.approval_evidence as string).trim() });
  } else if (body.action === 'archive') {
    if (before.status === 'archived') return crmResponse(409, { error: 'Already archived.' });
    patch.status = 'archived';
  } else {
    if (before.status === 'draft') return crmResponse(409, { error: 'Already a draft.' });
    Object.assign(patch, { status: 'draft', approved_by: null, approved_at: null, approval_evidence: null });
  }
  const { data, error } = await supabaseAdmin!.from('crm_campaign_drafts')
    .update(patch).eq('id', body.id).eq('status', before.status)
    .select('id,name,status,updated_at').maybeSingle();
  if (error) return crmResponse(503, { error: 'Draft update failed.' });
  if (!data) return crmResponse(409, { error: 'Draft changed concurrently.' });
  return crmResponse(200, { draft: data, sending_enabled: false });
}
// By design there is no campaign send, scheduler, recipient export or dispatch action.
