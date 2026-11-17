import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmTrimmed, crmUuid } from '../_lib/server';

export const dynamic = 'force-dynamic';
const requests = new Set(['access','erasure','objection']);

const parse = async (request: NextRequest): Promise<Record<string, unknown> | null> => {
  try {
    const input: unknown = await request.json();
    return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
  } catch { return null; }
};
export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  const id = request.nextUrl.searchParams.get('id');
  const exportRequested = request.nextUrl.searchParams.get('export') === 'reviewed';
  if (exportRequested) {
    if (!crmUuid(id)) return crmResponse(400, { error: 'Valid privacy request ID required.' });
    const { data: record, error } = await supabaseAdmin!.from('crm_privacy_requests')
      .select('id,contact_id,organisation_id,request_type,status,requester_verified')
      .eq('id', id).maybeSingle();
    if (error || !record) return crmResponse(404, { error: 'Privacy request not found.' });
    if (record.request_type !== 'access' || record.status !== 'approved' || !record.requester_verified || !record.contact_id)
      return crmResponse(403, { error: 'Verified and approved access request required.' });
    const { data: contact, error: contactError } = await supabaseAdmin!.from('crm_prospect_contacts')
      .select('id,organisation_id,person_name,job_title,business_email,business_phone,contact_kind,lawful_basis,lawful_basis_evidence,source_url,collected_at,first_notice_sent_at,retention_review_at')
      .eq('id', record.contact_id).eq('organisation_id', record.organisation_id).maybeSingle();
    if (contactError || !contact) return crmResponse(404, { error: 'Contact unavailable.' });
    return crmResponse(200, { generated_at: new Date().toISOString(), request_id: record.id, contact,
      note: 'Personal data export prepared for verified owner review; do not deliver without confirming requester identity and applicable exemptions.' });
  }
  const { data, error } = await supabaseAdmin!.from('crm_privacy_requests')
    .select('id,contact_id,organisation_id,request_type,status,requester_verified,legal_hold,legal_hold_reviewed_at,request_note,review_note,support_ticket_id,created_at,reviewed_at,completed_at')
    .order('created_at',{ ascending: false }).limit(100);
  if (error) return crmResponse(503, { error: 'Privacy workflow unavailable.' });
  return crmResponse(200, { requests: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCrm(request, true);
  if (auth.error) return auth.error;
  const body = await parse(request);
  if (!body || !crmUuid(body.contact_id) || !requests.has(String(body.request_type)) ||
      !crmTrimmed(body.request_note, 2000) || (body.request_note as string).trim().length < 10)
    return crmResponse(400, { error: 'Contact, request type and request evidence required.' });
  const { data: contact, error: lookupError } = await supabaseAdmin!.from('crm_prospect_contacts')
    .select('id,organisation_id,business_email,business_phone').eq('id', body.contact_id).maybeSingle();
  if (lookupError) return crmResponse(503, { error: 'Contact lookup unavailable.' });
  if (!contact) return crmResponse(404, { error: 'Contact not found.' });
  // Objections must be enforced immediately. Failure to create the admin
  // request afterwards never silently reverses the suppression.
  if (body.request_type === 'objection') {
    const identifiers = [
      contact.business_email && { channel: 'email', normalized_contact_value: contact.business_email.trim().toLowerCase() },
      contact.business_phone && { channel: 'phone', normalized_contact_value: contact.business_phone.replace(/[\s().-]/g,'') },
    ].filter(Boolean);
    for (const identifier of identifiers) {
      const { error } = await supabaseAdmin!.from('crm_prospect_suppressions')
        .upsert({ ...identifier, reason: 'objection', source: 'Privacy request: ' + (body.request_note as string).trim().slice(0,350) },
          { onConflict: 'channel,normalized_contact_value', ignoreDuplicates: true });
      if (error) return crmResponse(503, { error: 'Objection could not be enforced. Do not contact this person; escalate.' });
    }
  }
  const { data, error } = await supabaseAdmin!.from('crm_privacy_requests').insert({
    contact_id: contact.id, organisation_id: contact.organisation_id,
    request_type: body.request_type, request_note: (body.request_note as string).trim(),
    requester_verified: false, status: body.request_type === 'objection' ? 'fulfilled' : 'received',
    created_by: auth.owner!.id, last_actor_id: auth.owner!.id,
    completed_at: body.request_type === 'objection' ? new Date().toISOString() : null,
  }).select('id,request_type,status').single();
  if (error) return crmResponse(503, { error: 'Privacy request was not recorded; any objection remains suppressed.' });
  return crmResponse(201, { request: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeCrm(request, true);
  if (auth.error) return auth.error;
  const body = await parse(request);
  if (!body || !crmUuid(body.id) || !['review','hold_review','approve','reject','fulfil_access','execute_erasure','link_support'].includes(String(body.action)))
    return crmResponse(400, { error: 'Valid request ID and action required.' });
  const { data: record, error: readError } = await supabaseAdmin!.from('crm_privacy_requests')
    .select('id,status,request_type,contact_id,organisation_id,support_ticket_id,requester_verified,legal_hold,legal_hold_reviewed_at')
    .eq('id', body.id).maybeSingle();
  if (readError) return crmResponse(503, { error: 'Privacy request unavailable.' });
  if (!record) return crmResponse(404, { error: 'Privacy request not found.' });
  const evidence = typeof body.review_note === 'string' ? body.review_note.trim() : '';
  if (body.action === 'link_support') {
    if (record.support_ticket_id)
      return crmResponse(409,{error:'Privacy request is already linked to a canonical support case; no silent relinking.'});
    if (!crmUuid(body.support_ticket_id) || evidence.length < 30 || evidence.length > 2000)
      return crmResponse(400,{error:'Canonical support ticket UUID and reviewed relationship evidence (30+ characters) required.'});
    const [supportResult,organisationResult] = await Promise.all([
      supabaseAdmin!.from('support_tickets')
        .select('id,company_id,category').eq('id',body.support_ticket_id).maybeSingle(),
      supabaseAdmin!.from('crm_prospect_organisations')
        .select('id,converted_company_id').eq('id',record.organisation_id).maybeSingle(),
    ]);
    if (supportResult.error || organisationResult.error)
      return crmResponse(503,{error:'Cannot verify both canonical sources; no association saved.'});
    const ticket=supportResult.data,org=organisationResult.data;
    if(!ticket || ticket.category!=='compliance' || !org)
      return crmResponse(409,{error:'A verified compliance support ticket and CRM organisation are required.'});
    if(ticket.company_id && ticket.company_id!==org.converted_company_id)
      return crmResponse(409,{error:'Support ticket belongs to another member company; linking denied.'});
    const {data,error}=await supabaseAdmin!.from('crm_privacy_requests')
      .update({
        support_ticket_id:ticket.id,last_actor_id:auth.owner!.id,
        review_note:evidence,updated_at:new Date().toISOString(),
      })
      .eq('id',record.id).eq('status',record.status)
      .is('support_ticket_id',null)
      .select('id,status,support_ticket_id').maybeSingle();
    if(error)return crmResponse(error.code==='23505'?409:503,{
      error:error.code==='23505'?'Support ticket already belongs to another CRM request.':'Support case association failed.',
    });
    if(!data)return crmResponse(409,{error:'Privacy request changed during review; refresh.'});
    return crmResponse(200,{request:data,source:'existing_support_ticket',tickets_created:0});
  }
  if (body.action === 'execute_erasure') {
    if (record.request_type !== 'erasure' || record.status !== 'approved' || !record.requester_verified || record.legal_hold || !record.legal_hold_reviewed_at)
      return crmResponse(409, { error: 'Erasure not approved, identity unverified, or legal hold exists.' });
    if (evidence.length < 30 || evidence.length > 2000)
      return crmResponse(400, { error: 'Execution decision evidence (30–2000 characters) required.' });
    const { data, error } = await supabaseAdmin!.rpc('crm_execute_prospect_erasure', {
      p_request_id: record.id, p_actor_id: auth.owner!.id, p_evidence: evidence,
    });
    if (error) return crmResponse(503, { error: 'Atomic erasure failed; request remains pending.' });
    return crmResponse(200, { erasure: data, suppression_retained: true });
  }
  if (evidence.length < 20 || evidence.length > 2000)
    return crmResponse(400, { error: 'Documented review decision (20–2000 characters) required.' });
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(), last_actor_id: auth.owner!.id, review_note: evidence,
  };
  if (body.action === 'hold_review') {
    if (record.status !== 'reviewing' || record.request_type !== 'erasure' || typeof body.legal_hold !== 'boolean')
      return crmResponse(409, { error: 'Only reviewing erasure requests can record a documented legal-hold assessment.' });
    Object.assign(patch, { legal_hold: body.legal_hold, legal_hold_reviewed_at: new Date().toISOString(),
      legal_hold_reviewed_by: auth.owner!.id });
  } else if (body.action === 'review') {
    if (record.status !== 'received') return crmResponse(409, { error: 'Request is not awaiting review.' });
    patch.status = 'reviewing';
  } else if (body.action === 'approve') {
    if (record.status !== 'reviewing' || body.requester_verified !== true)
      return crmResponse(409, { error: 'Review and verified requester identity required.' });
    if (record.request_type === 'erasure' && (record.legal_hold || !record.legal_hold_reviewed_at))
      return crmResponse(409, { error: 'Explicit legal-hold assessment required; active holds block erasure.' });
    Object.assign(patch, { status: 'approved', requester_verified: true, reviewed_by: auth.owner!.id,
      reviewed_at: new Date().toISOString() });
  } else if (body.action === 'reject') {
    if (!['received','reviewing'].includes(record.status))
      return crmResponse(409, { error: 'Cannot reject an already approved or completed request.' });
    patch.status = 'rejected';
    patch.reviewed_by = auth.owner!.id;
    patch.reviewed_at = new Date().toISOString();
  } else {
    if (record.status !== 'approved' || record.request_type !== 'access')
      return crmResponse(409, { error: 'Only approved access exports can be fulfilled.' });
    patch.status = 'fulfilled';
    patch.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabaseAdmin!.from('crm_privacy_requests')
    .update(patch).eq('id', body.id).eq('status', record.status)
    .select('id,status,reviewed_at,completed_at').maybeSingle();
  if (error) return crmResponse(503, { error: 'Privacy workflow update failed.' });
  if (!data) return crmResponse(409, { error: 'Request changed concurrently.' });
  return crmResponse(200, { request: data });
}
