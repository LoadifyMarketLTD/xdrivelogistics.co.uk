import { NextRequest, NextResponse } from 'next/server';

import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../_lib/supabaseAdmin';

const respond=(status:number,payload:Record<string,unknown>)=>NextResponse.json(payload,{status,headers:{'Cache-Control':'no-store, max-age=0'}});

export async function GET(request:NextRequest){
  if(!isSupabaseAdminConfigured||!supabaseAdmin) return respond(503,{error:'Operational exception service is unavailable.'});
  const companyId=request.nextUrl.searchParams.get('companyId')?.trim()??'';
  if(!companyId) return respond(400,{error:'companyId is required.'});
  const token=getBearerToken(request);
  if(!token) return respond(401,{error:'Unauthorized.'});
  const validator=supabaseValidator??supabaseAdmin;
  const {data:auth,error:authError}=await validator.auth.getUser(token);
  if(authError||!auth.user) return respond(401,{error:'Invalid session.'});
  const {data:membership,error:membershipError}=await supabaseAdmin.from('company_memberships').select('role_in_company').eq('company_id',companyId).eq('user_id',auth.user.id).eq('status','active').maybeSingle();
  if(membershipError) return respond(503,{error:'Company access could not be verified.'});
  if(!membership) return respond(403,{error:'Active company membership required.'});

  const {data:jobs,error:jobsError}=await supabaseAdmin.from('jobs').select('id,pickup_location,pickup_postcode,delivery_location,delivery_postcode,current_status,status,updated_at').or(`company_id.eq.${companyId},assigned_company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`).limit(500);
  if(jobsError) return respond(500,{error:'Booking scope could not be loaded.'});
  const jobIds=(jobs??[]).map((job)=>String(job.id)).filter(Boolean);
  if(!jobIds.length) return respond(200,{exceptions:[]});
  const {data:exceptions,error}=await supabaseAdmin.from('job_operational_exceptions').select('id,job_id,company_id,category,severity,status,description,occurred_at,resolution_note,resolved_at,created_at,updated_at').in('job_id',jobIds).order('occurred_at',{ascending:false}).limit(500);
  if(error) return respond(500,{error:'Operational exceptions could not be loaded.'});
  const jobById=new Map((jobs??[]).map((job)=>[String(job.id),job]));
  return respond(200,{
    exceptions:(exceptions??[]).map((row)=>({ ...row, job: jobById.get(String(row.job_id))??null })),
  });
}
