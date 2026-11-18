import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmTrimmed, crmUuid } from '../_lib/server';

export const dynamic='force-dynamic';
const validAction=new Set(['review','accept','decline']);
const kinds=new Set(['membership','partnership','commercial','other']);
const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const page=Number(request.nextUrl.searchParams.get('page')??'1');
  const status=request.nextUrl.searchParams.get('status')??'all';
  if(!Number.isSafeInteger(page)||page<1||page>10000||
      !['all','new','reviewing','accepted','declined'].includes(status))
    return crmResponse(400,{error:'Invalid inbox page or status.'});
  let query=supabaseAdmin!.from('crm_business_interests')
    .select('id,business_name,business_email,contact_name,company_number,interest_kind,message,source,source_reference,marketing_opt_in,status,retained_until,retention_state,legal_hold,created_at,reviewed_at,review_note',
      {count:'exact'});
  if(status!=='all')query=query.eq('status',status);
  const {data,count,error}=await query.order('created_at',{ascending:false})
    .range((page-1)*30,page*30-1);
  if(error||count===null)return crmResponse(503,{error:'Business interest inbox unavailable.'});
  return crmResponse(200,{requests:data??[],total:count,page,
    note:'Submitted business interests are not registered clients, signed bookings, or marketing consent.'});
}

export async function POST(request:NextRequest){
  const auth=await authorizeCrm(request,true);
  if(auth.error)return auth.error;
  const body=await request.json().catch(()=>null);
  if(!body || typeof body!=='object'||Array.isArray(body))
    return crmResponse(400,{error:'Valid owner evidence required.'});
  const b=body as Record<string,unknown>;
  const businessName=typeof b.business_name==='string'?b.business_name.trim():'';
  const contactName=typeof b.contact_name==='string'?b.contact_name.trim():'';
  const businessEmail=typeof b.business_email==='string'?b.business_email.trim().toLowerCase():'';
  const companyNumber=typeof b.company_number==='string'?b.company_number.replace(/\s/g,'').toUpperCase():'';
  const message=typeof b.message==='string'?b.message.trim():'';
  const sourceRef=typeof b.source_reference==='string'?b.source_reference.trim():'';
  if(b.confirmation!=='RECORD_REAL_INBOUND_EMAIL' || !crmTrimmed(businessName,240)||
      contactName.length<2||contactName.length>120||
      !email.test(businessEmail)||businessEmail.length>254||
      companyNumber.length>32 || !kinds.has(String(b.interest_kind))||
      message.length<15||message.length>2000||
      sourceRef.length<40||sourceRef.length>500)
    return crmResponse(400,{error:'Actual received email, sender, business, source reference and owner confirmation required.'});
  // Sender message is untrusted evidence. Never execute it or trigger actions.
  const {data,error}=await supabaseAdmin!.from('crm_business_interests')
    .insert({business_name:businessName,business_email:businessEmail,
      contact_name:contactName,company_number:companyNumber||null,
      interest_kind:b.interest_kind,message,
      source:'owner_email_review',source_reference:sourceRef,marketing_opt_in:false,
      privacy_notice_accepted_at:null,status:'new'})
    .select('id').single();
  if(error||!data?.id)return crmResponse(503,{error:'Inbound email evidence was not saved.'});
  return crmResponse(201,{id:data.id,emails_sent:0,marketing_permission_inferred:false});
}

export async function PATCH(request:NextRequest){
  const auth=await authorizeCrm(request,true);
  if(auth.error)return auth.error;
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))return crmResponse(400,{error:'Review data required.'});
  const b=body as Record<string,unknown>;
  if(!crmUuid(b.id)||!([...validAction,'retention_extend','retention_minimise','legal_hold_set','legal_hold_release'].includes(String(b.action)))||
     !crmTrimmed(b.note,2000)||(b.note as string).trim().length<20)
    return crmResponse(400,{error:'Valid request, decision and at least 20 characters of review evidence required.'});
  if(['retention_extend','retention_minimise','legal_hold_set','legal_hold_release'].includes(String(b.action))) {
    if(b.confirmation!=='I_REVIEWED_RETENTION_LEGAL_BASIS' ||
       (b.note as string).trim().length<40) return crmResponse(400,{
      error:'Retention decision requires 40+ characters of legal-basis evidence and explicit owner confirmation.',
    });
    const {data,error}=await supabaseAdmin!.rpc('crm_manage_business_interest_retention',{
      p_interest_id:b.id,p_actor_id:auth.owner!.id,
      p_action:b.action,p_note:(b.note as string).trim(),
    });
    if(error)return crmResponse(['P0002','23514','22023'].includes(error.code??'')?409:503,{
      error:'Retention decision rejected. Check legal holds, expiry, enquiry state and linked commercial records.',
    });
    return crmResponse(200,{result:data,records_deleted:0,emails_sent:0});
  }
  const {data,error}=await supabaseAdmin!.rpc('crm_triage_business_interest',{
    p_interest_id:b.id,p_actor_id:auth.owner!.id,
    p_action:b.action,p_note:(b.note as string).trim(),
  });
  if(error)return crmResponse(['P0002','23514','22023'].includes(error.code??'')?409:503,{
    error:'Inbound request review rejected or source unavailable.',
  });
  return crmResponse(200,{result:data,contacts_copied:0,marketing_sent:0});
}
