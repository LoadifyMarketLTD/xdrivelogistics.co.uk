import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmHttps, crmResponse, crmUuid } from '../_lib/server';

export const dynamic = 'force-dynamic';
const kinds=new Set(['generic_business','named_person','unknown']);
const bases=new Set(['legitimate_interests','consent','other','undetermined']);
const statuses=new Set(['active','review_due','archived']);
const optional=(v:unknown,max:number)=>v==null || v==='' || (typeof v==='string' && v.trim().length<=max);
function contactFields(body:Record<string,unknown>) {
  if (!crmUuid(body.organisation_id) || !kinds.has(String(body.contact_kind)) ||
      !bases.has(String(body.lawful_basis)) || !crmHttps(body.source_url) ||
      !optional(body.person_name,200) || !optional(body.job_title,200) ||
      !optional(body.business_email,254) || !optional(body.business_phone,40) ||
      !optional(body.lawful_basis_evidence,2000) ||
      (body.contact_status && !statuses.has(String(body.contact_status)))) return null;
  const email=typeof body.business_email==='string'?body.business_email.trim().toLowerCase():'';
  const phone=typeof body.business_phone==='string'?body.business_phone.replace(/[\s().-]/g,''):'';
  if ((!email && !phone) ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      (phone && !/^\+[1-9]\d{6,14}$/.test(phone))) return null;
  if (body.contact_kind==='named_person' && body.lawful_basis==='undetermined') return null;
  if (body.lawful_basis!=='undetermined' &&
      (typeof body.lawful_basis_evidence!=='string' || body.lawful_basis_evidence.trim().length<10))
    return null;
  return {
    organisation_id:body.organisation_id,person_name:typeof body.person_name==='string'?body.person_name.trim()||null:null,
    job_title:typeof body.job_title==='string'?body.job_title.trim()||null:null,
    business_email:email||null,business_phone:phone||null,
    contact_kind:body.contact_kind,lawful_basis:body.lawful_basis,
    lawful_basis_evidence:typeof body.lawful_basis_evidence==='string'?body.lawful_basis_evidence.trim()||null:null,
    source_url:(body.source_url as string).trim(),
  };
}
async function parse(request:NextRequest) {
  try {
    const body:unknown=await request.json();
    if(body && typeof body==='object' && !Array.isArray(body))return body as Record<string,unknown>;
  } catch { return null; }
  return null;
}
async function checkSuppression(email:string|null,phone:string|null):Promise<'ok'|'suppressed'|'unavailable'> {
  for(const identifier of [{channel:'email',value:email},{channel:'phone',value:phone}]) {
    if(!identifier.value)continue;
    const {data,error}=await supabaseAdmin!.from('crm_prospect_suppressions')
      .select('id').in('channel',[identifier.channel,'all'])
      .eq('normalized_contact_value',identifier.value).limit(1);
    if(error)return 'unavailable';
    if(data?.length)return 'suppressed';
  }
  return 'ok';
}
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const orgId=request.nextUrl.searchParams.get('organisation_id');
  if(!crmUuid(orgId))return crmResponse(400,{error:'Valid organisation_id required.'});
  const {data,error}=await supabaseAdmin!.from('crm_prospect_contacts')
    .select('id,organisation_id,person_name,job_title,business_email,business_phone,contact_kind,lawful_basis,lawful_basis_evidence,source_url,collected_at,last_verified_at,first_notice_sent_at,retention_review_at,contact_status,corporate_subscriber_verified,lia_approved,tps_ctps_checked_at,tps_ctps_blocked')
    .eq('organisation_id',orgId).order('collected_at',{ascending:false}).limit(100);
  if(error)return crmResponse(503,{error:'CRM contacts unavailable.'});
  return crmResponse(200,{contacts:data??[]});
}
export async function POST(request:NextRequest) {
  const auth=await authorizeCrm(request,true);
  if(auth.error)return auth.error;
  const body=await parse(request);
  const fields=body?contactFields(body):null;
  if(!fields)return crmResponse(400,{error:'Contact needs valid provenance, identifiers and documented lawful basis.'});
  const gate=await checkSuppression(fields.business_email,fields.business_phone);
  if(gate!=='ok')return crmResponse(gate==='suppressed'?409:503,{error:gate==='suppressed'?'Contact is suppressed.':'Suppression registry unavailable.'});
  const now=new Date();
  const retention=new Date(now);
  retention.setUTCFullYear(retention.getUTCFullYear()+1);
  const {data,error}=await supabaseAdmin!.from('crm_prospect_contacts').insert({
    ...fields,retention_review_at:retention.toISOString(),last_verified_at:now.toISOString(),
    last_actor_id:auth.owner!.id,contact_status:'active',last_review_note:'Initial sourced contact added',
  }).select('id,organisation_id,contact_kind,collected_at').single();
  if(error)return crmResponse(error.code==='23505'||error.code==='23514'?409:503,{
    error:error.code==='23514'?'Contact suppressed or invalid.':error.code==='23505'?'Duplicate contact.':'Contact save failed.',
  });
  return crmResponse(201,{contact:data});
}
export async function PATCH(request:NextRequest) {
  const auth=await authorizeCrm(request,true);
  if(auth.error)return auth.error;
  const body=await parse(request);
  if(!body || !crmUuid(body.id))return crmResponse(400,{error:'Contact ID required.'});
  const {data:current,error:readError}=await supabaseAdmin!.from('crm_prospect_contacts')
    .select('id,organisation_id,contact_status').eq('id',body.id).maybeSingle();
  if(readError)return crmResponse(503,{error:'Contact lookup unavailable.'});
  if(!current)return crmResponse(404,{error:'Contact not found.'});
  if(body.action==='retention') {
    if(!statuses.has(String(body.contact_status)) ||
        typeof body.review_note!=='string' || body.review_note.trim().length<20 ||
        body.review_note.length>1000)
      return crmResponse(400,{error:'Documented retention decision and valid status required.'});
    const next=new Date();next.setUTCFullYear(next.getUTCFullYear()+1);
    const {data,error}=await supabaseAdmin!.from('crm_prospect_contacts')
      .update({contact_status:body.contact_status,retention_review_at:next.toISOString(),
        last_verified_at:new Date().toISOString(),last_actor_id:auth.owner!.id,
        last_review_note:(body.review_note as string).trim()})
      .eq('id',body.id).eq('contact_status',current.contact_status)
      .select('id,contact_status,retention_review_at').maybeSingle();
    if(error)return crmResponse(503,{error:'Retention decision failed.'});
    if(!data)return crmResponse(409,{error:'Contact changed concurrently.'});
    return crmResponse(200,{contact:data,decision_documented:true});
  }
  const fields=contactFields(body);
  if(!fields || fields.organisation_id!==current.organisation_id)
    return crmResponse(400,{error:'Invalid contact update or organisation mismatch.'});
  const gate=await checkSuppression(fields.business_email,fields.business_phone);
  if(gate!=='ok')return crmResponse(gate==='suppressed'?409:503,{error:gate==='suppressed'?'Contact suppressed.':'Suppression unavailable.'});
  const note=typeof body.review_note==='string'?body.review_note.trim():'';
  if(note.length<10 || note.length>1000)return crmResponse(400,{error:'Update evidence required (10–1000 chars).'});
  const {data,error}=await supabaseAdmin!.from('crm_prospect_contacts').update({
    ...fields,last_verified_at:new Date().toISOString(),last_actor_id:auth.owner!.id,
    last_review_note:note,corporate_subscriber_verified:body.corporate_subscriber_verified===true,
    lia_approved:body.lia_approved===true,
    tps_ctps_checked_at:body.tps_ctps_checked===true?new Date().toISOString():null,
    tps_ctps_blocked:body.tps_ctps_blocked===true,
    first_notice_sent_at:body.notice_delivered===true?new Date().toISOString():null,
  }).eq('id',body.id).eq('organisation_id',current.organisation_id)
    .select('id,organisation_id,contact_status,last_verified_at').maybeSingle();
  if(error)return crmResponse(error.code==='23505'||error.code==='23514'?409:503,{
    error:error.code==='23505'?'Duplicate identifier.':error.code==='23514'?'Contact suppressed.':'Contact update failed.',
  });
  if(!data)return crmResponse(409,{error:'Contact was modified concurrently.'});
  return crmResponse(200,{contact:data,audited:true});
}
