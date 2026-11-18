import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { assessOutreachEligibility, type ContactKind, type LegalForm } from '@/lib/business-development/outreachEligibility';
import { authorizeCrm, crmHttps, crmResponse, crmUuid } from '../_lib/server';

export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const auth=await authorizeCrm(request);
  if(auth.error)return auth.error;
  const id=request.nextUrl.searchParams.get('contact_id');
  const channel=request.nextUrl.searchParams.get('channel')??'email';
  if(!crmUuid(id) || !['email','phone'].includes(channel))
    return crmResponse(400,{error:'Valid contact ID and channel required.'});
  const {data:contact,error}=await supabaseAdmin!.from('crm_prospect_contacts')
    .select('id,organisation_id,contact_kind,business_email,business_phone,lawful_basis,lawful_basis_evidence,source_url,first_notice_sent_at,lia_approved,corporate_subscriber_verified,tps_ctps_checked_at,tps_ctps_blocked,contact_status')
    .eq('id',id).maybeSingle();
  if(error)return crmResponse(503,{error:'Contact unavailable.'});
  if(!contact)return crmResponse(404,{error:'Contact not found.'});
  const {data:org,error:orgError}=await supabaseAdmin!.from('crm_prospect_organisations')
    .select('id,legal_form,source_url').eq('id',contact.organisation_id).maybeSingle();
  if(orgError || !org)return crmResponse(503,{error:'Legal entity verification unavailable.'});
  const identifier=channel==='email'?contact.business_email:contact.business_phone;
  if(!identifier)return crmResponse(400,{error:'Contact has no identifier for selected channel.'});
  const {data:suppressions,error:suppressionError}=await supabaseAdmin!.from('crm_prospect_suppressions')
    .select('id').in('channel',[channel,'all'])
    .eq('normalized_contact_value',identifier).limit(1);
  if(suppressionError)return crmResponse(503,{error:'Suppression check failed (fail closed).'});
  const decision=assessOutreachEligibility({
    legalForm:org.legal_form as LegalForm,contactKind:contact.contact_kind as ContactKind,
    channel:channel as 'email'|'phone',
    hasDocumentedConsent:contact.lawful_basis==='consent' &&
      typeof contact.lawful_basis_evidence==='string' && contact.lawful_basis_evidence.length>=10,
    hasVerifiedSource:crmHttps(contact.source_url) && crmHttps(org.source_url),
    privacyNoticeReady:Boolean(contact.first_notice_sent_at),
    legitimateInterestsAssessmentApproved:contact.lia_approved===true,
    suppressed:Boolean(suppressions?.length) || contact.contact_status!=='active',
    corporateSubscriberVerified:contact.corporate_subscriber_verified===true,
    tpsCtpsChecked:Boolean(contact.tps_ctps_checked_at),
    tpsCtpsBlocked:contact.tps_ctps_blocked===true,
  });
  return crmResponse(200,{
    contact_id:id,channel,
    eligible_for_owner_legal_review:decision.allowed,
    reasons:decision.reasons,
    sending_enabled:false,
    note:'A green assessment is never authorisation to send; case-by-case legal approval is still mandatory.',
  });
}
