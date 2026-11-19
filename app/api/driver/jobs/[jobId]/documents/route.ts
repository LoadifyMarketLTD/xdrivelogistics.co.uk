import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../_lib/supabaseAdmin';
import { isWebDriverContext, requireActiveWebDriver } from '../../../_lib/webDriverContext';
import { buildSignedJobAttachments } from '../../../mobile/jobAttachmentPresentation';

export const dynamic = 'force-dynamic';
const reply=(status:number,body:Record<string,unknown>)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:NextRequest,{params}:{params:Promise<{jobId:string}>}) {
  if(!isSupabaseAdminConfigured || !supabaseAdmin) return reply(503,{error:'Document service is unavailable.'});
  const driver=await requireActiveWebDriver(request);
  if(!isWebDriverContext(driver)) return driver;
  const {jobId}=await params;
  const {data:job,error:jobError}=await supabaseAdmin.from('jobs').select('id,company_id').eq('id',jobId).eq('assigned_driver_id',driver.driverId).maybeSingle();
  if(jobError) return reply(503,{error:'Job access could not be verified.'});
  if(!job) return reply(404,{error:'This booking is not assigned to your driver account.'});
  const {data:rows,error}=await supabaseAdmin.from('job_documents').select('id,doc_type,file_name,created_at').eq('job_id',jobId).order('created_at',{ascending:false});
  if(error) return reply(503,{error:'Document records could not be loaded.'});
  try {
    const signed=await buildSignedJobAttachments([job]);
    const links=new Map((signed.get(jobId)??[]).map(item=>[item.id,item.url]));
    return reply(200,{documents:(rows??[]).map(row=>({id:row.id,name:row.file_name||'Job document',type:row.doc_type||'Document',createdAt:row.created_at,url:links.get(row.id)??null}))});
  } catch {return reply(503,{error:'Secure document links could not be verified. Retry to open documents.'});}
}
