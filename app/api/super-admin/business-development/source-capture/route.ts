import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmDomain, crmHttps, crmResponse, crmTrimmed, crmUuid } from '../_lib/server';

export const dynamic = 'force-dynamic';
const forms = new Set(['ltd', 'llp', 'sole_trader', 'other', 'unknown']);
const segments = new Set(['customer','broker','forwarder','carrier','mixed']);
const intakeCompanyId = () =>
  process.env.XDRIVE_PUBLIC_INTAKE_COMPANY_ID?.trim() ||
  process.env.XDRIVE_DEFAULT_COMPANY_ID?.trim() ||
  process.env.DEFAULT_COMPANY_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID?.trim() || '';

/**
 * Owner-confirmed capture of an internal source reference. Never copies a
 * tenant's contacts or assumes public enquiries are marketing opt-ins.
 * Production or staging only behind the explicit CRM write gate;
 * canonical sources must exist in the same verified database.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeCrm(request, true);
  if (auth.error) return auth.error;
  let body: Record<string,unknown>;
  try {
    const input:unknown = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error();
    body=input as Record<string,unknown>;
  } catch { return crmResponse(400,{error:'Valid JSON required.'}); }

  const type = String(body.source_type??'');
  const sourceId=body.source_id;
  const legalName=typeof body.legal_name==='string'?body.legal_name.trim():'';
  const number=typeof body.company_number==='string'
    ?body.company_number.replace(/\s/g,'').toUpperCase():'';
  const website=typeof body.website==='string'?body.website.trim():'';
  const verifiedSource=typeof body.verified_source_url==='string'
    ?body.verified_source_url.trim():'';
  const evidence=typeof body.relationship_evidence==='string'
    ?body.relationship_evidence.trim():'';
  const segment=String(body.segment??'customer');
  const legalForm=String(body.legal_form??'unknown');
  if (!['existing_customer','inbound_enquiry','business_interest'].includes(type) || !crmUuid(sourceId) ||
      legalName.length<2 || legalName.length>240 || number.length>32 ||
      !forms.has(legalForm) || !segments.has(segment) ||
      !crmHttps(verifiedSource) || (website && !crmHttps(website)) ||
      (!number && !website) || !crmTrimmed(evidence,350) || evidence.length<40 ||
      body.confirmation!=='CAPTURE_VERIFIED_SOURCE')
    return crmResponse(400,{error:'Owner must verify company identity, permitted source and documented relationship (40+ characters).'});
  const {data:member,error:memberError} = type==='existing_customer'
    ? await supabaseAdmin!.from('companies')
      .select('id,name,company_number,status').eq('id',sourceId).eq('status','active').maybeSingle()
    : {data:null,error:null};
  if(memberError)return crmResponse(503,{error:'Existing-member source unavailable.'});
  if(type==='existing_customer'){
    if(!member)return crmResponse(404,{error:'Source member is not an active registered company.'});
    const original=String(member.company_number??'').replace(/\s/g,'').toUpperCase();
    if(!number || !original || number!==original)
      return crmResponse(409,{error:'Verified company number must match the registered member; no unverified identity import.'});
  }
  if(type==='inbound_enquiry'){
    const intake=intakeCompanyId();
    if(!crmUuid(intake))
      return crmResponse(503,{error:'Public quote intake identity not configured.'});
    const {data:quote,error:quoteError}=await supabaseAdmin!.from('quotes')
      .select('id').eq('id',sourceId).eq('company_id',intake)
      .or('notes.ilike.%SOURCE: app.xdrivelogistics.co.uk%,notes.ilike.%SOURCE: www.xdrivelogistics.co.uk/public-quote-request%')
      .maybeSingle();
    if(quoteError)return crmResponse(503,{error:'Inbound service source unavailable.'});
    if(!quote)return crmResponse(404,{error:'No matching public inbound enquiry; unverified sources are not imported.'});
  }
  if(type==='business_interest'){
    const {data:interest,error:interestError}=await supabaseAdmin!
      .from('crm_business_interests')
      .select('id,business_name,company_number,status')
      .eq('id',sourceId).eq('status','accepted').maybeSingle();
    if(interestError)return crmResponse(503,{error:'Business-interest canonical source unavailable.'});
    if(!interest)return crmResponse(409,{error:'Business interest must have a documented accepted owner review before CRM capture.'});
    if(interest.company_number && String(interest.company_number).toUpperCase()!==number)
      return crmResponse(409,{error:'Verified registered company number must match the accepted source.'});
    if(!interest.company_number &&
       String(interest.business_name).trim().toLocaleLowerCase('en-GB')!==legalName.toLocaleLowerCase('en-GB'))
      return crmResponse(409,{error:'Prospect name must match the accepted inbound source unless the company number is verified.'});
  }
  const provenance=(type==='existing_customer'?'Registered XDrive company ':
    type==='inbound_enquiry'?'XDrive inbound quote ':'Owner-reviewed business interest ')
    +sourceId+' | Owner evidence: '+evidence;
  const {data,error}=await supabaseAdmin!.from('crm_prospect_organisations').insert({
    legal_name:legalName,company_number:number||null,website:website||null,
    website_domain:website?crmDomain(website):null,
    legal_form:legalForm,segment,source_type:type,source_url:verifiedSource,
    source_reference:provenance.slice(0,500),
    source_checked_at:new Date().toISOString(),status:'discovered',
    created_by:auth.owner!.id,owner_user_id:auth.owner!.id,last_actor_id:auth.owner!.id,
  }).select('id,legal_name,status,source_reference').single();
  if(error)return crmResponse(error.code==='23505'?409:503,{
    error:error.code==='23505'?'Duplicate company number or website domain.':'Source capture failed; no CRM record created.',
  });
  return crmResponse(201,{
    organisation:data,source_verified_in_database:true,contacts_copied:0,
    marketing_consent_inferred:false,messages_sent:0,
    note:'Source identity recorded with manual evidence; this is not proof of a paid order or permission for marketing.',
  });
}
