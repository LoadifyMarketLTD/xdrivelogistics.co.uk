import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmTrimmed, crmUuid } from '../_lib/server';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const auth=await authorizeCrm(request,true);
  if(auth.error)return auth.error;
  let body:Record<string,unknown>;
  try {
    const input:unknown=await request.json();
    if (!input || typeof input!=='object' || Array.isArray(input)) throw Error();
    body=input as Record<string,unknown>;
  } catch {return crmResponse(400,{error:'Invalid JSON.'});}
  if(!crmUuid(body.organisation_id) || !crmUuid(body.company_id) ||
     body.confirmation!=='LINK_VERIFIED_ONBOARDING' ||
     !crmTrimmed(body.evidence,1000) || body.evidence.trim().length<30)
    return crmResponse(400,{error:'Verified CRM prospect, member company and evidence required.'});
  const [orgResult,companyResult]=await Promise.all([
    supabaseAdmin!.from('crm_prospect_organisations')
      .select('id,legal_name,company_number,status,segment,converted_company_id')
      .eq('id',body.organisation_id).maybeSingle(),
    supabaseAdmin!.from('companies').select('id,name,company_number,status')
      .eq('id',body.company_id).maybeSingle(),
  ]);
  if(orgResult.error || companyResult.error)return crmResponse(503,{error:'CRM/member relationship lookup failed.'});
  const org=orgResult.data,company=companyResult.data;
  if(!org || !company)return crmResponse(404,{error:'Prospect or verified member company not found.'});
  if(org.status==='converted' || org.converted_company_id)
    return crmResponse(409,{error:'Prospect already converted.'});
  if(String(company.status).toLowerCase()!=='active')
    return crmResponse(409,{error:'Only independently approved, active member companies qualify.'});
  const pNumber=String(org.company_number??'').replace(/\s/g,'').toUpperCase();
  const cNumber=String(company.company_number??'').replace(/\s/g,'').toUpperCase();
  const sameNumber=!!pNumber && !!cNumber && pNumber===cNumber;
  if(!sameNumber)
    return crmResponse(409,{error:'Verified Companies House number match required; names alone cannot prove legal-entity identity.'});
  const {data:onboarding,error:onboardingError}=await supabaseAdmin!.from('onboarding_applications')
    .select('id,status').eq('company_id',company.id).eq('status','approved').limit(1);
  if(onboardingError)return crmResponse(503,{error:'Onboarding verification unavailable.'});
  if(!onboarding?.length)
    return crmResponse(409,{error:'No independently approved onboarding application for this member company.'});
  const {data,error}=await supabaseAdmin!.from('crm_prospect_organisations')
    .update({
      converted_company_id:company.id,status:'converted',last_actor_id:auth.owner!.id,
      last_change_note:'Verified onboarding linked: '+(body.evidence as string).trim(),
      updated_at:new Date().toISOString(),
    })
    .eq('id',org.id).eq('status',org.status).is('converted_company_id',null)
    .select('id,status,converted_company_id').maybeSingle();
  if(error)return crmResponse(error.code==='23505'?409:503,{error:'Conversion failed or company already linked.'});
  if(!data)return crmResponse(409,{error:'Prospect changed while linking. Refresh.'});
  return crmResponse(200,{organisation:data,verified_active_member:true,
    note:'Member conversion does not prove first job or completed booking.'});
}
