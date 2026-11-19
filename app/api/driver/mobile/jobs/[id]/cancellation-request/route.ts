import { NextRequest } from 'next/server';
import { isSupabaseAdminConfigured,supabaseAdmin } from '../../../../../_lib/supabaseAdmin';
import { getFeatureFlag } from '../../../../../_lib/platformFlags';
import { requireDriver,isDriverContext,respond } from '../../../_lib';
import { parseStopCancellation } from '../../../../../../../lib/jobs/driverStopExecution';

const active=new Set(['accepted','assigned','allocated','on_my_way','on_site_pickup','loaded','in_transit','on_site_delivery']);
const custodyStates=new Set(['loaded','in_transit','on_site_delivery']);
async function access(request:NextRequest,id:string,write:boolean){
 if(!isSupabaseAdminConfigured||!supabaseAdmin)return {error:respond(503,{error:'Server auth unavailable.'})};
 if(!(await getFeatureFlag(supabaseAdmin,'driver_mobile_app')))return {error:respond(503,{error:'Driver mobile app disabled.'})};
 const driver=await requireDriver(request,{requireOperationallyActive:write});
 if(!isDriverContext(driver))return {error:driver};
 const {data:job,error}=await supabaseAdmin.from('jobs').select('id,assigned_company_id,assigned_driver_id,status,current_status,is_test').eq('id',id).eq('assigned_driver_id',driver.driverId).maybeSingle();
 if(error)return {error:respond(503,{error:'Booking authority could not be verified.'})};
 if(!job)return {error:respond(404,{error:'Assigned booking not found.'})};
 if(!driver.companyId||job.assigned_company_id!==driver.companyId)return {error:respond(403,{error:'Booking belongs to another carrier.'})};
 return {driver,job};
}
async function records(id:string,companyId:string){
 return supabaseAdmin!.from('job_cancellation_requests').select('id,status,reason,created_at,decided_at,decision_notes').eq('job_id',id).eq('carrier_company_id',companyId).order('created_at',{ascending:false}).limit(20);
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const ctx=await access(request,id,false);
 if('error' in ctx&&ctx.error)return ctx.error;
 const {data,error}=await records(id,ctx.driver!.companyId!);
 return error?respond(503,{error:'Cancellation history unavailable.'}):respond(200,{ok:true,requests:data??[]});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const ctx=await access(request,id,true);
 if('error' in ctx&&ctx.error)return ctx.error;
 const {job,driver}=ctx;
 if(job!.is_test!==true)return respond(409,{error:'Cancellation request pilot is currently limited to designated test bookings.'});
 const status=String(job!.current_status||job!.status||'').toLowerCase();
 if(!active.has(status))return respond(409,{error:'This booking cannot be cancelled at its current stage.'});
 const body=await request.json().catch(()=>null);
 const parsed=parseStopCancellation(body?.cancellation);
 if(!parsed.ok)return respond(400,{error:parsed.error});
 const c=parsed.value;
 if(c.scope!=='job')return respond(409,{error:'Individual stop changes require separate route authorisation.'});
 const {data:stops,error:stopError}=await supabaseAdmin!.from('job_stops').select('id,stop_type,status').eq('job_id',id);
 if(stopError)return respond(503,{error:'Custody state could not be verified.'});
 if(!stops?.some(s=>s.id===body?.stop_id))return respond(400,{error:'A valid booking stop is required.'});
 const custody=c.goodsInCustody||custodyStates.has(status)||stops.some(s=>s.stop_type==='collection'&&s.status==='completed');
 if(custody&&(!c.goodsInCustody||c.goodsDisposition==='none'))return respond(409,{error:'Goods have been collected. Record their custody and requested disposition.'});
 const reason=[
 'Cancellation request (not approval).',
 'Instruction source: '+c.cancelledByRole,
 'Contact: '+(c.cancelledByName||'Not supplied'),
 'Channel: '+c.instructionChannel,
 'Reason: '+c.reason,
 'Goods in custody: '+(custody?'Yes':'No'),
 'Requested disposition: '+c.goodsDisposition,
 'Requested address: '+(c.resolutionAddress||'Not supplied'),
 'Driver notes: '+(c.notes||'None')
 ].join(' | ');
 if(reason.length>2000)return respond(400,{error:'Cancellation instruction exceeds 2000 characters. Shorten the notes.'});
 const {data,error}=await supabaseAdmin!.rpc('request_awarded_job_cancellation_atomic',{p_job_id:id,p_actor_user_id:driver!.userId,p_reason:reason});
 if(error){if(error.code==='23505')return respond(409,{error:'A cancellation request is already pending. Refresh its status.'});return respond(error.code==='42501'?403:409,{error:'Cancellation request could not be recorded.'});}
 if(!data||typeof data!=='object'||data.status!=='pending'||!data.requestId||data.jobId!==id)return respond(503,{error:'Cancellation request could not be confirmed. Check request history before retrying.'});
 return respond(201,{ok:true,requestId:data.requestId,status:'pending',custody,requiresAuthorisedDisposition:custody});
}