import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../_lib/supabaseAdmin';

export const dynamic='force-dynamic';
const schema=z.object({
  businessName:z.string().trim().min(2).max(240),
  contactName:z.string().trim().min(2).max(120),
  businessEmail:z.string().trim().email().max(254),
  companyNumber:z.string().trim().max(32).optional().default(''),
  interestKind:z.enum(['membership','partnership','commercial','other']),
  message:z.string().trim().min(15).max(2000),
  privacyAccepted:z.literal(true),
  marketingOptIn:z.boolean().optional().default(false),
  companyWebsite:z.string().max(150).optional().default(''), // Honeypot: must be empty
});
const respond=(status:number,body:Record<string,unknown>)=>
  NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});

const keyFor=(prefix:string,value:string)=>prefix+':'+
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

export async function POST(request:NextRequest){
  // A preview must never write to the Production lead intake database.
  if(process.env.CONTEXT!=='production' ||
     process.env.XDRIVE_PUBLIC_BUSINESS_INTEREST!=='enabled' ||
     !isSupabaseAdminConfigured || !supabaseAdmin)
    return respond(503,{error:'Business interest form is not available in this deployment.'});
  const suppliedOrigin=request.headers.get('origin');
  if(suppliedOrigin && suppliedOrigin!=='https://www.xdrivelogistics.co.uk')
    return respond(403,{error:'Origin not allowed.'});
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json') ||
     Number(request.headers.get('content-length')??0)>8000)
    return respond(413,{error:'Expected a short JSON enquiry.'});
  const body=await request.json().catch(()=>null);
  const parsed=schema.safeParse(body);
  if(!parsed.success)return respond(400,{error:'Please check the business enquiry fields.'});
  const input=parsed.data;
  if(input.companyWebsite)return respond(202,{accepted:true});
  const ip=(request.headers.get('x-nf-client-connection-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0,128);
  const rateKeys=[
    {key:keyFor('crm-business-ip',ip),limit:6},
    {key:keyFor('crm-business-email',input.businessEmail),limit:3},
  ];
  try{
    // Reuse the existing durable quote-intake limiter with isolated key scopes.
    for(const entry of rateKeys){
      const {data,error}=await supabaseAdmin.rpc('consume_public_quote_rate_limit',{
        p_rate_key:entry.key,p_limit:entry.limit,p_window_seconds:3600,
      });
      if(error)return respond(503,{error:'Enquiry protection is temporarily unavailable.'});
      if(data!==true)return respond(429,{error:'Too many enquiries. Please try again later.'});
    }
    const {data,error}=await supabaseAdmin.from('crm_business_interests').insert({
      business_name:input.businessName,
      business_email:input.businessEmail.toLowerCase(),
      contact_name:input.contactName,
      company_number:input.companyNumber.replace(/\s/g,'').toUpperCase() || null,
      interest_kind:input.interestKind,
      message:input.message,
      source:'contact_form',
      privacy_notice_accepted_at:new Date().toISOString(),
      marketing_opt_in:input.marketingOptIn,
      status:'new',
    }).select('id').single();
    if(error || !data?.id)return respond(503,{error:'Business enquiry could not be recorded.'});
    return respond(201,{
      accepted:true,reference:data.id,
      note:'Request queued for manual review. No marketing messages have been sent.',
    });
  }catch{return respond(503,{error:'Business enquiry service temporarily unavailable.'});}
}
