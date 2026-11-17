import { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin';
import { authorizeCrm, crmHttps, crmResponse, crmUuid } from '../_lib/server';
import {
  assessOutreachEligibility, type ContactKind, type LegalForm,
} from '@/lib/business-development/outreachEligibility';

export const dynamic = 'force-dynamic';

/** No contact export and no dispatch: an owner-only, bounded, fail-closed
 * assessment of selected CRM prospects for content planning only.
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeCrm(request);
  if (auth.error) return auth.error;
  const id = request.nextUrl.searchParams.get('campaign_id');
  if (!crmUuid(id)) return crmResponse(400, { error: 'Valid campaign ID required.' });
  const { data: draft, error: draftError } = await supabaseAdmin!
    .from('crm_campaign_drafts')
    .select('id,name,segment,channel,status').eq('id',id).maybeSingle();
  if (draftError) return crmResponse(503, { error: 'Campaign unavailable.' });
  if (!draft) return crmResponse(404, { error: 'Campaign not found.' });
  if (!['email','phone'].includes(draft.channel))
    return crmResponse(409, { error: 'Unsupported communication channel.' });

  const { data: organisations, count: allOrganisations, error: organisationsError } =
    await supabaseAdmin!.from('crm_prospect_organisations')
      .select('id,legal_form,source_url,status', { count: 'exact' })
      .eq('segment',draft.segment).in('status',['qualified','contacted','replied','onboarding'])
      .limit(101);
  if (organisationsError || allOrganisations === null)
    return crmResponse(503, { error: 'Prospect audience unavailable.' });
  const available = (organisations ?? []).slice(0,100);
  if (!available.length) return crmResponse(200, {
    campaign_id:id,channel:draft.channel,scanned_organisations:0,scanned_contacts:0,
    eligible_for_manual_legal_review:0,blocked:0,review_count:0,incomplete:false,
    sending_enabled:false,note:'No eligible-stage prospects. No contacts exported.',
  });

  const ids = available.map(org=>org.id);
  const { data: contacts, count: allContacts, error: contactsError } =
    await supabaseAdmin!.from('crm_prospect_contacts')
      .select('id,organisation_id,contact_kind,business_email,business_phone,lawful_basis,lawful_basis_evidence,source_url,first_notice_sent_at,lia_approved,corporate_subscriber_verified,tps_ctps_checked_at,tps_ctps_blocked,contact_status',{count:'exact'})
      .in('organisation_id',ids).limit(101);
  if (contactsError || allContacts === null)
    return crmResponse(503,{error:'Contact eligibility data unavailable.'});

  const reviewed = (contacts ?? []).slice(0,100);
  const identifiers = Array.from(new Set(reviewed.map(contact=>
    draft.channel==='email'
      ? String(contact.business_email??'').trim().toLowerCase()
      : String(contact.business_phone??'').replace(/[\s().-]/g,'')
  ).filter(Boolean)));
  const suppressed = new Set<string>();
  for(let offset=0;offset<identifiers.length;offset+=25){
    const part=identifiers.slice(offset,offset+25);
    const { data: entries, error: suppressionError } = await supabaseAdmin!
      .from('crm_prospect_suppressions')
      .select('normalized_contact_value').in('channel',[draft.channel,'all'])
      .in('normalized_contact_value',part);
    if(suppressionError) return crmResponse(503,{
      error:'Suppression registry unavailable. Audience review blocked.',
    });
    for(const entry of entries??[])suppressed.add(entry.normalized_contact_value);
  }

  const orgById = new Map(available.map(org=>[org.id,org]));
  const reasons = new Map<string,number>();
  const review=reviewed.map(contact=>{
    const org=orgById.get(contact.organisation_id);
    const value = draft.channel==='email'
      ? String(contact.business_email??'').trim().toLowerCase()
      : String(contact.business_phone??'').replace(/[\s().-]/g,'');
    const eligibility = assessOutreachEligibility({
      legalForm:(org?.legal_form??'unknown') as LegalForm,
      contactKind:contact.contact_kind as ContactKind,
      channel:draft.channel as 'email'|'phone',
      hasDocumentedConsent:contact.lawful_basis==='consent'
        && String(contact.lawful_basis_evidence??'').trim().length>=10,
      hasVerifiedSource:crmHttps(contact.source_url) && crmHttps(org?.source_url),
      privacyNoticeReady:!!contact.first_notice_sent_at,
      legitimateInterestsAssessmentApproved:contact.lia_approved===true,
      suppressed:!value || suppressed.has(value) || contact.contact_status!=='active',
      corporateSubscriberVerified:contact.corporate_subscriber_verified===true,
      tpsCtpsChecked:!!contact.tps_ctps_checked_at,
      tpsCtpsBlocked:contact.tps_ctps_blocked===true,
    });
    for(const reason of eligibility.reasons)reasons.set(reason,(reasons.get(reason)??0)+1);
    return {
      organisation_id:contact.organisation_id,contact_id:contact.id,
      eligible_for_manual_legal_review:eligibility.allowed,reasons:eligibility.reasons,
    };
  });
  const allowed=review.filter(item=>item.eligible_for_manual_legal_review).length;
  return crmResponse(200,{
    campaign_id:id,channel:draft.channel,campaign_status:draft.status,
    scanned_organisations:available.length,scanned_contacts:review.length,
    eligible_for_manual_legal_review:allowed,blocked:review.length-allowed,
    reasons:Object.fromEntries(reasons),review_count:review.length,
    incomplete:allOrganisations>100 || allContacts>100,
    sending_enabled:false,contacts_exported:0,messages_sent:0,
    note:'Bounded sample only. Preliminary eligibility never authorises sending; no recipient export or dispatch.',
  });
}
