import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSupabaseAdminConfigured, supabaseAdmin, supabaseValidator } from '../../../_lib/supabaseAdmin';
import { resolveWorkspaceRole } from '../../../../../lib/workspaceRole';
import { hasWorkspaceCapabilityForContext } from '../../../../../lib/roleCapabilities';
import { calculateHistoricalUkInterest, type RatePeriod, type DebtPayment } from '../../../../../lib/finance/historicalUkInterest';

const json=(status:number,body:Record<string,unknown>)=>NextResponse.json(body,{status});
async function auth(req:NextRequest){
  if(!isSupabaseAdminConfigured||!supabaseAdmin)return {error:json(503,{error:'Finance unavailable'})};
  const token=getBearerToken(req);if(!token)return {error:json(401,{error:'Unauthorized'})};
  const {data}=await (supabaseValidator??supabaseAdmin).auth.getUser(token);
  if(!data.user)return {error:json(401,{error:'Unauthorized'})};
  const userId=data.user.id;
  const [{data:members},{data:profile}]=await Promise.all([
    supabaseAdmin.from('company_memberships').select('company_id,role_in_company').eq('user_id',userId).eq('status','active'),
    supabaseAdmin.from('profiles').select('role').eq('user_id',userId).maybeSingle(),
  ]);
  const companyIds=(members??[]).filter((m:{company_id:string;role_in_company:string})=>{
    const role=resolveWorkspaceRole({role:profile?.role,rawRole:profile?.role,membershipRole:m.role_in_company});
    return hasWorkspaceCapabilityForContext(role,'invoices.carrier.manage',{membershipRole:m.role_in_company});
  }).map((m:{company_id:string})=>m.company_id);
  if(!companyIds.length)return {error:json(403,{error:'Carrier finance permission required'})};
  return {userId,companyIds};
}
export async function GET(req:NextRequest){
  const a=await auth(req);if('error'in a)return a.error!;
  const {data,error}=await supabaseAdmin!.from('invoice_late_payment_cases')
    .select('id,invoice_id,status,interest_claim_gbp,compensation_claim_gbp,recovered_gbp,assessment,review_notes,updated_at')
    .in('creditor_company_id',a.companyIds!).order('updated_at',{ascending:false}).limit(250);
  return error?json(503,{error:'Late-payment migration not available'}):json(200,{cases:data??[]});
}
export async function POST(req:NextRequest){
  const a=await auth(req);if('error'in a)return a.error!;
  const b=await req.json().catch(()=>null) as Record<string,unknown>|null;
  if(!b||typeof b.invoiceId!=='string'||typeof b.action!=='string')return json(400,{error:'Invalid request'});
  const {data:invoice}=await supabaseAdmin!.from('invoices')
    .select('id,company_id,supplier_company_id,buyer_company_id,amount,currency,due_date')
    .eq('id',b.invoiceId).maybeSingle();
  const creditor=String(invoice?.supplier_company_id??invoice?.company_id??'');
  if(!invoice||!a.companyIds!.includes(creditor))return json(404,{error:'Invoice outside creditor scope'});
  const {data:c,error:readError}=await supabaseAdmin!.from('invoice_late_payment_cases')
    .select('*').eq('invoice_id',b.invoiceId).maybeSingle();
  if(readError)return json(503,{error:'Register unavailable'});
  if(b.action==='create'){
    const original=Number(invoice.amount);
    if(c)return json(409,{error:'Case exists'});
    if(invoice.currency!=='GBP'||!invoice.due_date||!Number.isFinite(original)||original<=0)return json(422,{error:'Eligible GBP invoice required'});
    const {data:created,error}=await supabaseAdmin!.from('invoice_late_payment_cases').insert({
      invoice_id:invoice.id,creditor_company_id:creditor,debtor_company_id:invoice.buyer_company_id,
      original_debt_gbp:original,created_by:a.userId,status:'draft',
    }).select('id').single();
    if(error)return json(409,{error:error.message});
    const {error:audit}=await supabaseAdmin!.from('invoice_late_payment_events').insert({case_id:created.id,actor_user_id:a.userId,event_type:'created'});
    return audit?json(503,{error:'Case created but audit write failed'}):json(201,{caseId:created.id,status:'draft'});
  }
  if(!c)return json(404,{error:'Case missing'});
  const transitions:Record<string,string[]>={review:['draft','under_review'],approve:['under_review'],claim:['approved'],recover:['claimed','partially_recovered'],waive:['draft','under_review','approved','claimed','partially_recovered'],reject:['under_review']};
  if(!transitions[b.action]?.includes(String(c.status)))return json(409,{error:'Invalid transition'});
  const note=typeof b.note==='string'?b.note.trim().slice(0,2000):'';
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  let event=String(b.action);let amount:number|null=null;
  if(b.action==='review'){
    if(!Array.isArray(b.ratePeriods)||!Array.isArray(b.payments)||typeof b.throughDate!=='string'||b.ratePeriods.length>100||b.payments.length>500)return json(422,{error:'Verified history required'});
    let estimate;
    try{estimate=calculateHistoricalUkInterest({
      dueDate:String(invoice.due_date).slice(0,10),throughDate:b.throughDate,
      originalDebtGbp:Number(c.original_debt_gbp),
      baseRatePeriods:b.ratePeriods as RatePeriod[],payments:b.payments as DebtPayment[],
    });}catch(e){return json(422,{error:e instanceof Error?e.message:'Invalid history'});}
    if(!estimate)return json(422,{error:'No overdue balance'});
    Object.assign(patch,{status:'under_review',rate_schedule:b.ratePeriods,payment_schedule:b.payments,
      assessment:estimate,interest_claim_gbp:estimate.interestGbp,compensation_claim_gbp:estimate.compensationGbp,review_notes:note});
    event='reviewed';
  }else if(b.action==='approve'){
    if(!note)return json(422,{error:'Approval rationale required'});
    Object.assign(patch,{status:'approved',approved_by:a.userId,approved_at:new Date().toISOString(),review_notes:note});
  }else if(b.action==='claim')patch.status='claimed';
  else if(b.action==='waive'||b.action==='reject'){
    if(!note)return json(422,{error:'Reason required'});patch.status=b.action==='waive'?'waived':'rejected';
  }else if(b.action==='recover'){
    amount=Number(b.amountGbp);
    if(!Number.isFinite(amount)||amount<=0||!note)return json(422,{error:'Recovery amount and reference required'});
    const total=Number(c.interest_claim_gbp)+Number(c.compensation_claim_gbp)+Number(c.recovery_cost_claim_gbp);
    const recovered=Math.round((Number(c.recovered_gbp)+amount)*100)/100;
    if(recovered>total+0.005)return json(422,{error:'Recovery exceeds claim'});
    patch.recovered_gbp=recovered;patch.status=recovered>=total-0.005?'recovered':'partially_recovered';event='recovery_recorded';
  }
  const {data:updated,error}=await supabaseAdmin!.from('invoice_late_payment_cases')
    .update(patch).eq('id',c.id).eq('status',c.status).select('id,status').maybeSingle();
  if(error||!updated)return json(409,{error:'Case changed; refresh'});
  const {error:audit}=await supabaseAdmin!.from('invoice_late_payment_events').insert({
    case_id:c.id,actor_user_id:a.userId,event_type:event,amount_gbp:amount,note:note||null,
    event_data:{previousStatus:c.status,newStatus:updated.status},
  });
  return audit?json(503,{error:'Case updated but audit write failed'}):json(200,{caseId:updated.id,status:updated.status});
}
