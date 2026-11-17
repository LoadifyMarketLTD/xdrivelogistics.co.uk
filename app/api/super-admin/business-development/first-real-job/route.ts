import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmResponse, crmTrimmed, crmUuid } from '../_lib/server';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const {data,count,error}=await supabaseAdmin!.from('crm_verified_first_real_jobs')
    .select('id,organisation_id,company_id,job_id,verified_at',{count:'exact'})
    .order('verified_at',{ascending:false}).limit(30);
  if(error||count===null)return crmResponse(503,{error:'Verified real-job evidence unavailable.'});
  return crmResponse(200,{verified_first_jobs:count,recent:data??[],
    test_jobs_included:false,financial_revenue_inferred:false,
    note:'Only manual, documented non-test job attestations are counted. No revenue is inferred.'});
}
export async function POST(request:NextRequest){
  const auth=await authorizeCrm(request,true);
  if(auth.error)return auth.error;
  // All existing job records were declared test. Keep the confirmation
  // operation explicitly locked until real commercial transactions exist.
  if(process.env.XDRIVE_CRM_REAL_JOB_ATTESTATION!=='enabled')
    return crmResponse(403,{error:'Real-job attestation locked until genuine work is independently available.'});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object'||Array.isArray(body))
    return crmResponse(400,{error:'Valid documentary evidence required.'});
  const b=body as Record<string,unknown>;
  if(!crmUuid(b.organisation_id)||!crmUuid(b.job_id)||
     !crmTrimmed(b.evidence,2000)||(b.evidence as string).trim().length<60 ||
     b.confirmation!=='I_VERIFIED_THIS_IS_A_REAL_PAID_OR_CONTRACTED_JOB_NOT_TEST')
    return crmResponse(400,{error:'Verified prospect, job, 60-character documentary evidence and exact confirmation required.'});
  const {data,error}=await supabaseAdmin!.rpc('crm_attest_first_real_job',{
    p_organisation_id:b.organisation_id,p_job_id:b.job_id,
    p_actor_id:auth.owner!.id,p_evidence:(b.evidence as string).trim(),
    p_confirmation:b.confirmation,
  });
  if(error)return crmResponse(['23514','23505','23503','22023','P0002'].includes(error.code??'')?409:503,{
    error:'Real-job certification denied: test, incomplete, mismatched, duplicate or unverifiable job.',
  });
  return crmResponse(201,{result:data,real_jobs_verified:1,revenue_attributed:null,
    note:'A completed, externally documented non-test first job was attested. Payment is NOT verified.'});
}
