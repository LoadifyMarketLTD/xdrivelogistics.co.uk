import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmUuid } from '../_lib/server';

export const dynamic='force-dynamic';

/** Read-only attribution research. The platform's job records may be test
 * fixtures even on a live environment. Never declare real booked/completed
 * shipments or revenue from this lookup.
 */
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const id=request.nextUrl.searchParams.get('organisation_id');
  const page=Number(request.nextUrl.searchParams.get('page')??'1');
  if(!crmUuid(id) || !Number.isSafeInteger(page) || page<1 || page>10000)
    return crmResponse(400,{error:'Valid CRM prospect and page required.'});
  const {data:org,error:orgError}=await supabaseAdmin!.from('crm_prospect_organisations')
    .select('id,status,company_number,converted_company_id').eq('id',id).maybeSingle();
  if(orgError)return crmResponse(503,{error:'CRM prospect unavailable.'});
  if(!org)return crmResponse(404,{error:'Prospect not found.'});
  if(org.status!=='converted' || !org.converted_company_id)
    return crmResponse(200,{
      organisation_id:id,linked_member:false,total_job_records:0,
      job_records:[],verified_real_jobs:null,verified_bookings:null,
      note:'No independently verified active member conversion; jobs cannot be attributed.',
    });
  const {data:member,error:memberError}=await supabaseAdmin!.from('companies')
    .select('id,name,company_number,status').eq('id',org.converted_company_id).maybeSingle();
  if(memberError || !member)return crmResponse(503,{error:'Linked active company unavailable.'});
  const orgNum=String(org.company_number??'').replace(/\s/g,'').toUpperCase();
  const memberNum=String(member.company_number??'').replace(/\s/g,'').toUpperCase();
  if(member.status!=='active' || !orgNum || orgNum!==memberNum)
    return crmResponse(409,{error:'Commercial identity no longer passes active-member verification.'});

  const {data:jobs,count,error}=await supabaseAdmin!.from('jobs')
    .select('id,company_id,status,created_at',{count:'exact'})
    .eq('company_id',member.id).order('created_at',{ascending:false})
    .range((page-1)*25,page*25-1);
  if(error || count===null)
    return crmResponse(503,{error:'Linked company job evidence unavailable.'});
  return crmResponse(200,{
    organisation_id:id,member_id:member.id,linked_member:true,page,
    total_job_records:count,
    job_records:(jobs??[]).map(job=>({
      id:job.id,created_at:job.created_at,
      recorded_status:job.status,verified_real_world:false,
    })),
    verified_real_jobs:null,verified_bookings:null,verified_revenue_gbp:null,
    attribution_approved:false,
    note:'These are existing platform job records only. They can be test jobs. No job, POD, completion, payment or commercial revenue is asserted real without independent evidence.',
  });
}
