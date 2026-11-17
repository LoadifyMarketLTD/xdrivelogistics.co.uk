import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../_lib/supabaseAdmin';
import { authorizeCrm, crmDomain, crmHttps, crmResponse, crmTrimmed, crmUuid } from './_lib/server';

export const dynamic = 'force-dynamic';
const forms = new Set(['ltd','llp','sole_trader','other','unknown']);
const segments = new Set(['customer','broker','forwarder','carrier','mixed']);
const statuses = new Set(['discovered','researching','qualified','contacted','replied','onboarding','converted','disqualified']);
const editableStatuses = new Set([...statuses].filter(status => status !== 'converted'));
const priorities = new Set(['low','normal','high']);
const sources = new Set(['companies_house','company_website','existing_customer','partner_referral','inbound_enquiry','owner_csv']);

const parse = async (request: NextRequest): Promise<Record<string, unknown> | null> => {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string,unknown> : null;
  } catch { return null; }
};
const optionalText = (value: unknown, max: number) =>
  value == null || value === '' || (typeof value === 'string' && value.trim().length <= max);
function followUp(value: unknown): string | null | undefined {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || date.getUTCFullYear()<2020 || date.getUTCFullYear()>2050) return undefined;
  return date.toISOString();
}
function validateFields(body: Record<string,unknown>) {
  if (!crmTrimmed(body.legal_name, 240) || body.legal_name.trim().length < 2 ||
      !optionalText(body.company_number,32) || !optionalText(body.website,2048) ||
      !optionalText(body.source_reference,500) || !forms.has(String(body.legal_form)) ||
      !segments.has(String(body.segment)) || !crmHttps(body.source_url) ||
      (body.website && !crmHttps(body.website)) ||
      (body.source_type && !sources.has(String(body.source_type))) ||
      (['existing_customer','partner_referral','inbound_enquiry'].includes(String(body.source_type)) &&
        (typeof body.source_reference !== 'string' || body.source_reference.trim().length < 3)) ||
      (body.priority && !priorities.has(String(body.priority))) ||
      followUp(body.next_follow_up_at) === undefined) return false;
  return true;
}
function companyPayload(body: Record<string,unknown>) {
  const website = typeof body.website === 'string' ? body.website.trim() : '';
  const number = typeof body.company_number === 'string' ? body.company_number.replace(/\s/g,'').toUpperCase() : '';
  return {
    legal_name: (body.legal_name as string).trim(),
    company_number: number || null, website: website || null,
    website_domain: website ? crmDomain(website) : null,
    legal_form: body.legal_form, segment: body.segment,
    source_type: body.source_type ?? 'company_website',
    source_url: (body.source_url as string).trim(),
    source_reference: typeof body.source_reference === 'string' ? body.source_reference.trim() || null : null,
    priority: body.priority ?? 'normal',
    next_follow_up_at: followUp(body.next_follow_up_at),
  };
}

export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  const p = request.nextUrl.searchParams;
  const page = Number(p.get('page') ?? '1');
  const search=(p.get('search')??'').trim();
  const segment=p.get('segment')??'';
  const status=p.get('status')??'';
  const priority=p.get('priority')??'';
  const source=p.get('source_type')??'';
  const due=p.get('due')==='true';
  if (!Number.isSafeInteger(page) || page<1 || page>100000 || search.length>120 ||
      /[,()%]/.test(search) || (segment && !segments.has(segment)) ||
      (status && !statuses.has(status)) || (priority && !priorities.has(priority)) ||
      (source && !sources.has(source)))
    return crmResponse(400,{ error:'Invalid CRM filters.' });
  const limit=25;
  let q=supabaseAdmin!.from('crm_prospect_organisations')
    .select('id,legal_name,company_number,website,website_domain,legal_form,segment,status,source_type,source_url,source_reference,source_checked_at,priority,owner_user_id,next_follow_up_at,created_at,updated_at', { count:'exact' });
  if (search) q=q.or('legal_name.ilike.%'+search+'%,company_number.ilike.%'+search+'%');
  if (segment) q=q.eq('segment',segment);
  if (status) q=q.eq('status',status);
  if (priority) q=q.eq('priority',priority);
  if (source) q=q.eq('source_type',source);
  if (due) q=q.lte('next_follow_up_at',new Date().toISOString()).not('next_follow_up_at','is',null);
  const { data,count,error }=await q.order('created_at',{ascending:false}).range((page-1)*limit,page*limit-1);
  if (error) return crmResponse(503,{ error:'CRM organisations unavailable; migration may not be applied.' });
  return crmResponse(200,{ organisations:data??[],total:count??0,page,limit });
}

export async function POST(request: NextRequest) {
  const auth=await authorizeCrm(request,true);
  if (auth.error) return auth.error;
  const body=await parse(request);
  if (!body || !validateFields(body)) return crmResponse(400,{ error:'Invalid prospect fields or HTTPS provenance.' });
  const record=companyPayload(body);
  const { data,error }=await supabaseAdmin!.from('crm_prospect_organisations').insert({
    ...record, source_checked_at:new Date().toISOString(), created_by:auth.owner!.id,
    owner_user_id:auth.owner!.id, last_actor_id:auth.owner!.id,
  }).select('id,legal_name,company_number,status,created_at').single();
  if (error) return crmResponse(error.code==='23505'?409:503,{
    error:error.code==='23505'?'Duplicate company number or website domain.':'CRM create failed.',
  });
  return crmResponse(201,{ organisation:data });
}

export async function PATCH(request: NextRequest) {
  const auth=await authorizeCrm(request,true);
  if (auth.error) return auth.error;
  const body=await parse(request);
  if (!body || !crmUuid(body.id)) return crmResponse(400,{ error:'Valid prospect ID required.' });
  const { data:current,error:readError }=await supabaseAdmin!.from('crm_prospect_organisations')
    .select('id,status,owner_user_id').eq('id',body.id).maybeSingle();
  if (readError) return crmResponse(503,{ error:'Organisation unavailable.' });
  if (!current) return crmResponse(404,{ error:'Organisation not found.' });
  if (current.status==='converted') return crmResponse(409,{ error:'Converted organisations are immutable without verified onboarding reconciliation.' });
  const note=typeof body.note==='string'?body.note.trim():'';
  if (note.length>1000) return crmResponse(400,{ error:'Note exceeds 1000 characters.' });
  const patch:Record<string,unknown>={ updated_at:new Date().toISOString(),last_actor_id:auth.owner!.id };
  if (body.action==='edit') {
    if (!validateFields(body)) return crmResponse(400,{ error:'Invalid edited prospect fields.' });
    Object.assign(patch,companyPayload(body));
    if (body.owner_user_id!=null && body.owner_user_id!=='') {
      if (!crmUuid(body.owner_user_id)) return crmResponse(400,{ error:'Valid CRM owner required.' });
      const {data:assigned,error:ownerError}=await supabaseAdmin!.from('profiles')
        .select('user_id').eq('user_id',body.owner_user_id).eq('role','owner').eq('status','active').maybeSingle();
      if (ownerError || !assigned) return crmResponse(403,{ error:'Assigned CRM owner must be an active Platform Owner.' });
      patch.owner_user_id=assigned.user_id;
    }
    patch.last_change_note=note||'Organisation evidence, priority or follow-up edited';
  } else if (body.action==='status' || body.action==null) {
    if (!editableStatuses.has(String(body.status))) return crmResponse(400,{ error:'Invalid status; conversion requires verified onboarding.' });
    if (body.status===current.status) return crmResponse(200,{ organisation:current,unchanged:true });
    patch.status=body.status;
    patch.last_change_note=note||String(current.status)+' -> '+String(body.status);
  } else return crmResponse(400,{ error:'Unsupported prospect action.' });
  const {data,error}=await supabaseAdmin!.from('crm_prospect_organisations').update(patch)
    .eq('id',body.id).eq('status',current.status)
    .select('id,legal_name,company_number,website,legal_form,segment,status,source_url,source_type,source_reference,priority,owner_user_id,next_follow_up_at,updated_at').maybeSingle();
  if(error) return crmResponse(error.code==='23505'?409:503,{ error:error.code==='23505'?'Duplicate company number or domain.':'Prospect update failed.' });
  if(!data) return crmResponse(409,{ error:'Organisation changed concurrently; refresh and retry.' });
  return crmResponse(200,{ organisation:data,audited:true });
}
