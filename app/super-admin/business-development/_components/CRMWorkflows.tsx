'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { SuperAdminNotice, SuperAdminSectionCard } from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Org = {
  id: string; legal_name: string; company_number?: string | null; website?: string | null;
  legal_form: string; segment: string; status: string; source_url: string;
  source_type?: string; source_reference?: string | null; priority?: string;
  next_follow_up_at?: string | null; owner_user_id?: string | null; updated_at?: string;
  created_at: string;
};
type Contact = {
  id: string; organisation_id: string; person_name: string | null; job_title: string | null;
  business_email: string | null; business_phone: string | null; contact_kind: string;
  lawful_basis: string; lawful_basis_evidence: string | null; source_url: string;
  contact_status: string; corporate_subscriber_verified: boolean; lia_approved: boolean;
  tps_ctps_checked_at: string | null; tps_ctps_blocked: boolean; first_notice_sent_at: string | null;
};
type ResearchCandidate = {
  company_name:string;company_number:string;company_status:string;
  company_type:string|null;sic_codes:string[];locality:string|null;
  source_url:string;already_in_crm:boolean;
};
type CompanyMatch = {
  company_name:string|null;company_number:string;
  company_status:string|null;company_type?:string|null;source_url:string;
};
type Inbound = {id:string;submitted_name:string|null;status:string;created_at:string;source_url:string;source_reference:string};
type RegisteredMember = {id:string;name:string|null;company_number:string|null;status:string;source_reference:string};
type SourceCandidate = {
  source_type:'existing_customer'|'inbound_enquiry';source_id:string;legal_name:string;
  company_number:string;website:string;verified_source_url:string;
  relationship_evidence:string;legal_form:string;segment:string;
};
type Campaign = {
  id: string; name: string; segment: string; channel: string; subject: string | null;
  body: string; status: string; approval_evidence: string | null;
};
type CampaignAudience = {
  scanned_organisations:number;scanned_contacts:number;
  eligible_for_manual_legal_review:number;blocked:number;
  incomplete:boolean;sending_enabled:boolean;reasons:Record<string,number>;
  review_count:number;
};
type PrivacyRequest = {
  id: string; contact_id: string | null; request_type: string; status: string;
  requester_verified: boolean; legal_hold: boolean; legal_hold_reviewed_at?: string | null; request_note: string;
};
type Metrics = {
  organisations: number; contacts: number; campaign_drafts: number; follow_ups_due: number;
  by_status: Record<string,number>; by_segment: Record<string,number>;
  recorded_reply_events?:number;recorded_call_attempts?:number;
  recorded_meetings?:number;verified_member_conversions?:number;
};
type Preview = {
  dryRun: boolean; total: number; valid: number; writes: number;
  preview_sha256: string; preview_token: string | null; rows: { row:number;valid:boolean;errors:string[] }[];
};
const sourceTypes = [
  ['companies_house','Companies House'],['company_website','Verified public website'],
  ['existing_customer','Existing XDrive customer'],['partner_referral','Partner referral'],
  ['inbound_enquiry','Inbound enquiry'],['owner_csv','Owner-reviewed CSV'],
];
const defaultCampaign = {name:'',segment:'customer',channel:'email',subject:'',body:''};
const note = { display:'grid', gap:10, maxWidth:780 } as const;

async function crmApi<T>(path:string, method='GET', body?:unknown):Promise<T> {
  const auth=await getAuthHeader();
  if(!auth)throw new Error('Active Platform Owner session required.');
  const res=await fetch('/api/super-admin/business-development'+path,{
    method,cache:'no-store',
    headers:{ Authorization:auth, ...(body!==undefined?{'Content-Type':'application/json'}:{}) },
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  });
  const response=await res.json() as T & {error?:string};
  if(!res.ok)throw new Error(response.error??'CRM request failed.');
  return response;
}

export default function CRMWorkflows({ selected, readOnly, onUpdated, onSelect, onPopulate }: {
  selected: Org | null; readOnly: boolean;
  onUpdated: (org:Partial<Org>)=>void;
  onSelect: (org:Org)=>void;
  onPopulate: (fields:Partial<{legal_name:string;company_number:string;source_url:string;
    legal_form:string;source_type:string;source_reference:string;segment:string}>)=>void;
}) {
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [reload,setReload]=useState(0);
  const [metrics,setMetrics]=useState<Metrics|null>(null);
  const [queueBucket,setQueueBucket]=useState('overdue');
  const [queuePage,setQueuePage]=useState(1);
  const [queue,setQueue]=useState<Org[]>([]);
  const [queueTotal,setQueueTotal]=useState(0);
  const [queueError,setQueueError]=useState('');
  const [manualActivity,setManualActivity]=useState('note');
  const [manualChannel,setManualChannel]=useState('other');
  const [manualNote,setManualNote]=useState('');
  const [manualFollowupMode,setManualFollowupMode]=useState('preserve');
  const [manualNextDate,setManualNextDate]=useState('');
  const [manualContactId,setManualContactId]=useState('');
  const [drafts,setDrafts]=useState<Campaign[]>([]);
  const [privacy,setPrivacy]=useState<PrivacyRequest[]>([]);
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [edit,setEdit]=useState({
    legal_name:'',company_number:'',website:'',legal_form:'unknown',segment:'customer',
    source_url:'',source_type:'company_website',source_reference:'',priority:'normal',
    next_follow_up_at:'',owner_user_id:'',note:'',
  });
  const [companyNumber,setCompanyNumber]=useState('');
  const [companySearch,setCompanySearch]=useState('');
  const [researchSector,setResearchSector]=useState('warehousing');
  const [researchPage,setResearchPage]=useState(1);
  const [researchCandidates,setResearchCandidates]=useState<ResearchCandidate[]>([]);
  const [researchHits,setResearchHits]=useState(0);
  const [companyMatches,setCompanyMatches]=useState<CompanyMatch[]>([]);
  const [inbounds,setInbounds]=useState<Inbound[]>([]);
  const [registeredMembers,setRegisteredMembers]=useState<RegisteredMember[]>([]);
  const [sourceCandidate,setSourceCandidate]=useState<SourceCandidate|null>(null);
  const [memberSearch,setMemberSearch]=useState('');
  const [inboundPage,setInboundPage]=useState(1);
  const [memberPage,setMemberPage]=useState(1);
  const [companyResult,setCompanyResult]=useState<null|{
    company_name:string;company_number:string;company_status:string;company_type?:string;source_url:string
  }>(null);
  const [csv,setCsv]=useState('legal_name,company_number,website,legal_form,segment,source_url\n');
  const [csvPreview,setCsvPreview]=useState<Preview|null>(null);
  const [csvConfirmed,setCsvConfirmed]=useState(false);
  const [campaign,setCampaign]=useState(defaultCampaign);
  const [selectedDraftId,setSelectedDraftId]=useState('');
  const [campaignAudience,setCampaignAudience]=useState<CampaignAudience|null>(null);
  const [approvalEvidence,setApprovalEvidence]=useState('');
  const [privacyType,setPrivacyType]=useState('access');
  const [privacyContactId,setPrivacyContactId]=useState('');
  const [privacyNote,setPrivacyNote]=useState('');
  const [reviewNote,setReviewNote]=useState('');
  const [requesterVerified,setRequesterVerified]=useState(false);
  const [holdDecision,setHoldDecision]=useState('unchecked');
  const [eraseConfirmed,setEraseConfirmed]=useState('');
  const [exportValue,setExportValue]=useState('');
  const [contactId,setContactId]=useState('');
  const [contactReview,setContactReview]=useState('');
  const [contactForm,setContactForm]=useState<Contact|null>(null);
  const [contactRetentionNote,setContactRetentionNote]=useState('');
  const [eligibility,setEligibility]=useState('');
  const [conversionCompanyId,setConversionCompanyId]=useState('');
  const [conversionEvidence,setConversionEvidence]=useState('');
  const [working,setWorking]=useState(false);

  useEffect(()=>{
    let active=true;
    const fetchMain=async()=>{
      const [m,c,p]=await Promise.allSettled([
        crmApi<Metrics>('/dashboard'),
        crmApi<{drafts:Campaign[]}>('/campaigns'),
        crmApi<{requests:PrivacyRequest[]}>('/privacy-requests'),
      ]);
      if(!active)return;
      if(m.status==='fulfilled')setMetrics(m.value);else setMetrics(null);
      if(c.status==='fulfilled')setDrafts(c.value.drafts);
      if(p.status==='fulfilled')setPrivacy(p.value.requests);
    };
    void fetchMain();
    return()=>{active=false;};
  },[reload]);
  useEffect(()=>{
    let active = true;
    void crmApi<{organisations:Org[];total:number}>(
      '/follow-ups?bucket='+encodeURIComponent(queueBucket)+'&page='+queuePage,
    ).then(result=>{
      if (!active) return;
      setQueue(result.organisations);
      setQueueTotal(result.total);
      setQueueError('');
    }).catch(error=>{
      if (!active) return;
      setQueue([]);
      setQueueTotal(0);
      setQueueError(error instanceof Error ? error.message : 'Follow-up queue unavailable.');
    });
    return ()=>{active=false;};
  },[queueBucket,queuePage,reload]);

  useEffect(()=>{
    setEdit({
      legal_name:selected?.legal_name??'',company_number:selected?.company_number??'',
      website:selected?.website??'',legal_form:selected?.legal_form??'unknown',
      segment:selected?.segment??'customer',source_url:selected?.source_url??'',
      source_type:selected?.source_type??'company_website',
      source_reference:selected?.source_reference??'',priority:selected?.priority??'normal',
      next_follow_up_at:selected?.next_follow_up_at?.slice(0,16)??'',
      owner_user_id:selected?.owner_user_id??'',note:'',
    });
    setContactId('');setManualContactId('');setContactForm(null);setEligibility('');
    let active=true;
    if(selected)void crmApi<{contacts:Contact[]}>('/contacts?organisation_id='+encodeURIComponent(selected.id))
      .then(value=>{if(active)setContacts(value.contacts);})
      .catch(()=>{if(active)setContacts([]);});
    else setContacts([]);
    return()=>{active=false;};
  },[selected]);

  async function run(task:()=>Promise<void>) {
    if(working)return;
    setWorking(true);setError('');setNotice('');
    try { await task();setReload(x=>x+1); }
    catch(e){setError(e instanceof Error?e.message:'CRM action failed.');}
    finally{setWorking(false);}
  }
  const loadIndustryResearch=()=>run(async()=>{
    const result=await crmApi<{candidates:ResearchCandidate[];total_registry_hits:number}>(
      '/research-targets?sector='+encodeURIComponent(researchSector)+'&page='+researchPage);
    setResearchCandidates(result.candidates);
    setResearchHits(result.total_registry_hits);
    setNotice('Official Companies House industry research loaded. No contact data imported; every business needs individual review.');
  });
  const lookupCompany=()=>run(async()=>{
    const data=await crmApi<{company_name:string;company_number:string;company_status:string;company_type?:string;source_url:string}>(
      '/companies-house?company_number='+encodeURIComponent(companyNumber));
    setCompanyResult(data);
    setNotice('Companies House lookup completed. This did not import or contact anyone.');
  });
  const searchCompanies=()=>run(async()=>{
    const result=await crmApi<{companies:CompanyMatch[]}>(
      '/companies-house?q='+encodeURIComponent(companySearch.trim()));
    setCompanyMatches(result.companies);
    setNotice('Official registry search returned '+result.companies.length+' records. None have been imported.');
  });
  const loadInbounds=()=>run(async()=>{
    const result=await crmApi<{enquiries:Inbound[]}>('/inbound-enquiries?page='+inboundPage);
    setInbounds(result.enquiries);
    setNotice('Read-only XDrive public intake records loaded. No contacts were imported.');
  });
  const loadMembers=()=>run(async()=>{
    const result=await crmApi<{members:RegisteredMember[]}>(
      '/existing-members?page='+memberPage+'&search='+encodeURIComponent(memberSearch));
    setRegisteredMembers(result.members);
    setNotice('Active platform companies shown; none are represented as paying customers without proof.');
  });
  const captureInternalSource=()=>run(async()=>{
    if(readOnly || !sourceCandidate)throw Error('Select and verify an internal source in isolated staging.');
    const result=await crmApi<{organisation:{id:string;legal_name:string}}>('/source-capture','POST',{
      ...sourceCandidate,confirmation:'CAPTURE_VERIFIED_SOURCE',
    });
    setNotice('Verified source captured as CRM prospect '+result.organisation.legal_name+
      '. No tenant contact copied and no messages sent.');
    setSourceCandidate(null);
  });
  const previewCsv=()=>run(async()=>{
    const result=await crmApi<Preview>('/csv-preview','POST',{csv});
    setCsvPreview(result);setCsvConfirmed(false);
    setNotice('Dry run complete: 0 writes.');
  });
  const importCsv=()=>run(async()=>{
    if(!csvPreview || !csvPreview.preview_token || !csvConfirmed || csvPreview.valid!==csvPreview.total)
      throw Error('All rows must pass preview and receive explicit owner confirmation.');
    const result=await crmApi<{imported:number}>('/csv-import','POST',{
      csv,preview_sha256:csvPreview.preview_sha256,preview_token:csvPreview.preview_token,reviewed:true,
      confirmation:'IMPORT_VERIFIED_PROSPECTS',
    });
    setCsvPreview(null);setCsvConfirmed(false);
    setNotice(result.imported+' organisation records staged; no contacts imported or messages sent.');
  });
  const saveOrg=(event:FormEvent)=>{event.preventDefault();if(!selected || readOnly)return;void run(async()=>{
    const result=await crmApi<{organisation:Org}>('','PATCH',{
      id:selected.id,action:'edit',...edit,
      next_follow_up_at:edit.next_follow_up_at?new Date(edit.next_follow_up_at).toISOString():null,
    });
    onUpdated(result.organisation);setNotice('Prospect changes recorded in the audit trail.');
  });};
  const createDraft=(event:FormEvent)=>{event.preventDefault();if(readOnly)return;void run(async()=>{
    const response=await crmApi<{draft:Campaign}>('/campaigns','POST',campaign);
    setSelectedDraftId(response.draft.id);setCampaign(defaultCampaign);
    setNotice('Campaign draft saved. No delivery/sending capability exists.');
  });};
  const campaignAction=(action:string)=>run(async()=>{
    if(readOnly || !selectedDraftId)throw Error('Select a draft in isolated staging.');
    await crmApi('/campaigns','PATCH',{
      id:selectedDraftId,action,approval_evidence:approvalEvidence,
      ...((action==='edit')?campaign:{}),
    });
    setApprovalEvidence('');
    setNotice('Campaign '+action+' recorded. No messages sent.');
  });
  const previewCampaignAudience=()=>run(async()=>{
    if(!selectedDraftId)throw Error('Select a saved campaign draft.');
    const result=await crmApi<CampaignAudience>(
      '/campaign-audience?campaign_id='+encodeURIComponent(selectedDraftId));
    setCampaignAudience(result);
    setNotice('Bounded preliminary audience review only. No recipients exported and no messages sent.');
  });
  const privacyCreate=(event:FormEvent)=>{event.preventDefault();if(readOnly)return;void run(async()=>{
    await crmApi('/privacy-requests','POST',{
      contact_id:privacyContactId,request_type:privacyType,request_note:privacyNote,
    });
    setPrivacyNote('');setNotice('Privacy request recorded. Objections are suppressed immediately.');
  });};
  const privacyAction=(id:string,action:string)=>run(async()=>{
    if(readOnly)throw Error('Isolated staging required.');
    if(action==='execute_erasure' && eraseConfirmed!=='ERASE_CONTACT')throw Error('Type ERASE_CONTACT to confirm erasure.');
    await crmApi('/privacy-requests','PATCH',{
      id,action,requester_verified:requesterVerified,review_note:reviewNote,
      ...(action==='hold_review'?{legal_hold:holdDecision==='yes'}:{}),
    });
    setEraseConfirmed('');setReviewNote('');
    setNotice('Privacy decision recorded; audit and suppression are retained as applicable.');
  });
  const privacyExport=(id:string)=>run(async()=>{
    const result=await crmApi<unknown>('/privacy-requests?id='+encodeURIComponent(id)+'&export=reviewed');
    setExportValue(JSON.stringify(result,null,2));
    setNotice('Reviewed data export displayed below. Verify requester before disclosure.');
  });
  const loadContact=(id:string)=>{
    setContactId(id);
    setContactForm(contacts.find(contact=>contact.id===id)??null);setEligibility('');
  };
  const saveContact=(event:FormEvent)=>{event.preventDefault();if(!contactForm || readOnly)return;void run(async()=>{
    await crmApi('/contacts','PATCH',{
      ...contactForm,id:contactForm.id,
      organisation_id:contactForm.organisation_id,
      tps_ctps_checked:!!contactForm.tps_ctps_checked_at,
      notice_delivered:!!contactForm.first_notice_sent_at,
      review_note:contactReview,
    });
    if(selected){
      const updated=await crmApi<{contacts:Contact[]}>('/contacts?organisation_id='+encodeURIComponent(selected.id));
      setContacts(updated.contacts);
    }
    setContactReview('');setNotice('Contact classification / evidence updated and audited.');
  });};
  const checkEligibility=(channel:'email'|'phone')=>run(async()=>{
    if(!contactForm)throw Error('Select a contact.');
    const result=await crmApi<{eligible_for_owner_legal_review:boolean;reasons:string[]}>(
      '/outreach-check?contact_id='+encodeURIComponent(contactForm.id)+'&channel='+channel);
    setEligibility(result.eligible_for_owner_legal_review ?
      'Passed preliminary manual review checks. Sending is still DISABLED.' :
      'Blocked: '+result.reasons.join('; '));
  });
  const retentionAction=(status:string)=>run(async()=>{
    if(!contactForm || readOnly)throw Error('Select a contact in isolated staging.');
    await crmApi('/contacts','PATCH',{id:contactForm.id,action:'retention',
      contact_status:status,review_note:contactRetentionNote});
    setContactRetentionNote('');setNotice('Human retention review recorded.');
  });
  const recordManualAction=()=>run(async()=>{
    if (readOnly || !selected) throw Error('Select a prospect in isolated staging.');
    if (manualNote.trim().length < 10) throw Error('Record at least ten characters of actual activity evidence.');
    const result=await crmApi<{result:{status:string;next_follow_up_at:string|null}}>(
      '/follow-ups','POST',{
        organisation_id:selected.id,
        contact_id:manualContactId || null,
        event_type:manualActivity,channel:manualChannel,note:manualNote.trim(),
        follow_up_action:manualFollowupMode,
        next_follow_up_at:manualFollowupMode==='schedule' && manualNextDate
          ? new Date(manualNextDate).toISOString() : null,
      });
    setManualNote('');
    setManualFollowupMode('preserve');
    setManualNextDate('');
    onUpdated({status:result.result.status,next_follow_up_at:result.result.next_follow_up_at});
    setNotice('Actual activity and follow-up recorded together; no outbound message was generated.');
  });
  const conversion=(event:FormEvent)=>{event.preventDefault();if(!selected || readOnly)return;void run(async()=>{
    const result=await crmApi<{organisation:Org}>('/onboarding-link','POST',{
      organisation_id:selected.id,company_id:conversionCompanyId,
      evidence:conversionEvidence,confirmation:'LINK_VERIFIED_ONBOARDING',
    });
    onUpdated(result.organisation);setConversionEvidence('');
    setNotice('Prospect linked to a real active member company; no loads or bookings inferred.');
  });};
  return <>
    {error && <SuperAdminNotice tone="danger">{error}</SuperAdminNotice>}
    {notice && <SuperAdminNotice tone="info">{notice}</SuperAdminNotice>}
    <SuperAdminSectionCard title="Commercial acquisition — evidence-based scorecard">
      {metrics ? <>
        <p>{metrics.organisations} verified/research prospect records · {metrics.contacts} sourced contacts · {metrics.follow_ups_due} follow-ups due · {metrics.campaign_drafts} campaign drafts</p>
        <p>Pipeline: {Object.entries(metrics.by_status).map(([key,value])=>key+': '+value).join(' · ')}</p>
        <p>Segments: {Object.entries(metrics.by_segment).map(([key,value])=>key+': '+value).join(' · ')}</p>
        <p>Manually documented replies: {metrics.recorded_reply_events??0} ·
          Recorded call attempts: {metrics.recorded_call_attempts??0} ·
          Recorded meetings: {metrics.recorded_meetings??0} ·
          Verified active-member conversions: {metrics.verified_member_conversions??0}</p>
        <p>These figures reflect CRM entries, not independently proven shipment transactions.</p>
      </> : <p>CRM metrics unavailable until isolated schema is applied.</p>}
      <p>First live loads, real bookings and completed jobs are not inferred from CRM statuses.</p>
      <button type="button" onClick={()=>setReload(x=>x+1)}>Refresh verified counts</button>
    </SuperAdminSectionCard>

    <SuperAdminSectionCard title="Follow-up work queue — manual prospect operations">
      <p>Due and upcoming actions from verified CRM records. Reviewing the queue never contacts a business.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
        <label>Queue
          <select value={queueBucket} onChange={e=>{setQueueBucket(e.target.value);setQueuePage(1);}}>
            <option value="overdue">Overdue</option><option value="today">Today</option>
            <option value="next7">Next seven days</option><option value="unscheduled">Not scheduled</option>
            <option value="all">All open prospects</option>
          </select>
        </label>
        <button type="button" onClick={()=>setReload(x=>x+1)} disabled={working}>Refresh queue</button>
        <button type="button" disabled={queuePage<=1 || working} onClick={()=>setQueuePage(x=>x-1)}>Previous</button>
        <span>Page {queuePage}; {queueTotal} matching records</span>
        <button type="button" disabled={working || queuePage*25>=queueTotal} onClick={()=>setQueuePage(x=>x+1)}>Next</button>
      </div>
      {queueError && <p role="alert">{queueError}</p>}
      {queue.length===0 ? <p>No matching CRM follow-ups.</p> : <div style={{overflowX:'auto'}}>
        <table><thead><tr><th>Prospect</th><th>Segment</th><th>Priority</th><th>Status</th><th>Next action due</th><th>Review</th></tr></thead>
          <tbody>{queue.map(item=><tr key={item.id}>
            <td>{item.legal_name}</td><td>{item.segment}</td><td>{item.priority??'normal'}</td>
            <td>{item.status}</td>
            <td>{item.next_follow_up_at?new Date(item.next_follow_up_at).toLocaleString('en-GB'):'Not scheduled'}</td>
            <td><button type="button" onClick={()=>{onSelect(item);setManualContactId('');}}>Open prospect</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
      {selected && <div style={{...note,marginTop:12}}>
        <p>Record an actual action for <strong>{selected.legal_name}</strong>. This is a manual event, not an instruction to send.</p>
        <label>Actual activity
          <select value={manualActivity} onChange={e=>setManualActivity(e.target.value)}>
            <option value="note">Research / internal note</option>
            <option value="research_completed">Research completed</option>
            <option value="qualified">Qualified with evidence</option>
            <option value="call_attempted">Call attempted (not proven contacted)</option>
            <option value="meeting_scheduled">Meeting arranged</option>
            <option value="reply_received">Reply actually received</option>
            <option value="onboarding_started">Onboarding actually started</option>
            <option value="disqualified">Disqualified with reason</option>
          </select>
        </label>
        <label>Channel
          <select value={manualChannel} onChange={e=>setManualChannel(e.target.value)}>
            <option value="other">Internal / other</option><option value="email">Email</option><option value="phone">Phone</option>
          </select>
        </label>
        <label>Linked contact (optional)
          <select value={manualContactId} onChange={e=>setManualContactId(e.target.value)}>
            <option value="">No linked contact</option>
            {contacts.map(c=><option key={c.id} value={c.id}>{c.person_name??c.business_email??c.id}</option>)}
          </select>
        </label>
        <label>What actually happened, and supporting evidence
          <textarea required minLength={10} maxLength={2000} rows={3} value={manualNote} onChange={e=>setManualNote(e.target.value)} />
        </label>
        <label>After recording this action
          <select value={manualFollowupMode} onChange={e=>setManualFollowupMode(e.target.value)}>
            <option value="preserve">Keep existing follow-up date</option>
            <option value="schedule">Schedule a future follow-up</option>
            <option value="clear">Clear outstanding follow-up</option>
          </select>
        </label>
        {manualFollowupMode==='schedule' && <label>Future follow-up date/time
          <input required type="datetime-local" value={manualNextDate} onChange={e=>setManualNextDate(e.target.value)}/>
        </label>}
        <button type="button" disabled={readOnly || working || manualNote.trim().length<10 ||
          selected.status==='converted' || selected.status==='disqualified' ||
          (manualFollowupMode==='schedule' && !manualNextDate)} onClick={()=>void recordManualAction()}>
          Record action and update pipeline atomically
        </button>
      </div>}
    </SuperAdminSectionCard>

    <SuperAdminSectionCard title="Source 1 — Companies House verification">
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <label>Find companies by official register search <input value={companySearch} onChange={e=>setCompanySearch(e.target.value)} maxLength={100} /></label>
        <button type="button" disabled={working || companySearch.trim().length<3} onClick={()=>void searchCompanies()}>Find registered businesses</button>
      </div>
      {companyMatches.length>0 && <div style={{overflowX:'auto'}}><table>
        <thead><tr><th>Company</th><th>Number</th><th>Status</th><th>Owner action</th></tr></thead>
        <tbody>{companyMatches.map(item=><tr key={item.company_number}>
          <td>{item.company_name}</td><td>{item.company_number}</td><td>{item.company_status}</td>
          <td><button type="button" onClick={()=>{
            onPopulate({legal_name:item.company_name??'',company_number:item.company_number,
              source_url:item.source_url,legal_form:item.company_type==='llp'?'llp':'unknown',
              source_type:'companies_house'});
            window.scrollTo({top:0,behavior:'smooth'});
          }}>Prefill for owner verification</button></td>
        </tr>)}</tbody>
      </table></div>}
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <label>Registered company number <input value={companyNumber} onChange={e=>setCompanyNumber(e.target.value)} maxLength={8} /></label>
        <button type="button" onClick={()=>void lookupCompany()} disabled={working}>Lookup official register</button>
      </div>
      {companyResult && <div>
        <p>{companyResult.company_name} · {companyResult.company_number} · {companyResult.company_status}</p>
        <a href={companyResult.source_url} target="_blank" rel="noopener noreferrer">Official company record</a>
        <p><button type="button" onClick={()=>onPopulate({
          legal_name:companyResult.company_name,company_number:companyResult.company_number,
          legal_form:companyResult.company_type==='llp'?'llp':'unknown',source_type:'companies_house',source_url:companyResult.source_url,
        })}>Prefill owner-reviewed prospect form</button></p>
      </div>}
      <p>Other sources: {sourceTypes.slice(1).map(x=>x[1]).join(' · ')}. All require owner-verified provenance and manual intake; no scraping or outbound contact.</p>
    </SuperAdminSectionCard>

    <SuperAdminSectionCard title="Industry research — Companies House SIC targeting">
      <p>Search active UK companies in transport-dependent industries. These are research candidates,
        not confirmed XDrive customers or automatically contactable leads.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
        <label>Business sector
          <select value={researchSector} onChange={e=>{setResearchSector(e.target.value);setResearchPage(1);setResearchCandidates([]);}}>
            <option value="warehousing">Warehousing</option>
            <option value="cargo_handling">Cargo handling</option>
            <option value="wholesale_general">General wholesale</option>
            <option value="machinery_wholesale">Machinery wholesalers</option>
            <option value="intermediate_wholesale">Intermediate goods wholesalers</option>
            <option value="freight_support">Forwarders and transport support</option>
            <option value="road_freight">Road carriers</option>
          </select>
        </label>
        <label>Research page (1–5)
          <select value={researchPage} onChange={e=>setResearchPage(Number(e.target.value))}>
            {[1,2,3,4,5].map(number=><option key={number} value={number}>{number}</option>)}
          </select>
        </label>
        <button type="button" disabled={working} onClick={()=>void loadIndustryResearch()}>Search official registry</button>
      </div>
      <p>Registry matches reported: {researchHits}. This page displays at most 20; the 100-record research window requires five pages and independent verification.</p>
      {researchCandidates.length>0 && <div style={{overflowX:'auto'}}>
        <table><thead><tr><th>Official company name</th><th>Number</th><th>Town</th><th>SIC</th><th>Already in CRM?</th><th>Review</th></tr></thead>
          <tbody>{researchCandidates.map(item=><tr key={item.company_number}>
            <td>{item.company_name}</td><td>{item.company_number}</td><td>{item.locality??'Not provided'}</td>
            <td>{item.sic_codes.join(', ')}</td><td>{item.already_in_crm?'Yes':'No'}</td>
            <td><button type="button" disabled={item.already_in_crm} onClick={()=>onPopulate({
              legal_name:item.company_name,company_number:item.company_number,source_url:item.source_url,
              legal_form:item.company_type==='llp'?'llp':item.company_type==='ltd'?'ltd':'unknown',
              source_type:'companies_house',
              segment:researchSector==='road_freight'?'carrier':researchSector==='freight_support'?'broker':'customer',
            })}>Prefill for manual company verification</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p>Official classification does not prove the company ships freight, is an active prospect,
        or has given marketing permission. Never import personal details from the register by default.</p>
    </SuperAdminSectionCard>

    <SuperAdminSectionCard title="Source 5 — existing XDrive public enquiries (read-only)">
      <p>Published website quote requests are service enquiries, not permission for marketing. No personal contact details are copied to the CRM.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button type="button" disabled={working || inboundPage<=1} onClick={()=>setInboundPage(p=>p-1)}>Previous page</button>
        <span>Page {inboundPage}</span>
        <button type="button" disabled={working} onClick={()=>setInboundPage(p=>p+1)}>Next page</button>
        <button type="button" disabled={working} onClick={()=>void loadInbounds()}>Load enquiry page</button>
      </div>
      {inbounds.length===0?<p>No enquiry records loaded.</p>:
        <div style={{overflowX:'auto'}}><table>
          <thead><tr><th>Submitted name</th><th>Received</th><th>Service status</th><th>Evidence</th></tr></thead>
          <tbody>{inbounds.map(item=><tr key={item.id}>
            <td>{item.submitted_name}</td>
            <td>{new Date(item.created_at).toLocaleDateString('en-GB')}</td>
            <td>{item.status}</td>
            <td><button type="button" onClick={()=>onPopulate({
              source_type:'inbound_enquiry',source_reference:item.source_reference,source_url:item.source_url,
            })}>Use as source only</button>
              <button type="button" onClick={()=>setSourceCandidate({
                source_type:'inbound_enquiry',source_id:item.id,legal_name:'',company_number:'',
                website:'',verified_source_url:'',relationship_evidence:'',legal_form:'unknown',segment:'customer',
              })}>Review and capture</button></td>
          </tr>)}</tbody>
        </table></div>}
      <p>The owner must independently verify the organisation and marketing basis before saving a prospect or contact.</p>
    </SuperAdminSectionCard>

    <SuperAdminSectionCard title="Source 3 — registered XDrive members for relationship verification">
      <p>Company registration is not proof of a paying customer. This read-only directory never imports another tenant's contacts.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <label>Search registered companies <input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} maxLength={100}/></label>
        <button type="button" disabled={working} onClick={()=>void loadMembers()}>Find registered companies</button>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button type="button" disabled={working || memberPage<=1} onClick={()=>setMemberPage(p=>p-1)}>Previous page</button>
        <span>Page {memberPage}</span>
        <button type="button" disabled={working} onClick={()=>setMemberPage(p=>p+1)}>Next page</button>
      </div>
      {registeredMembers.length>0 && <div style={{overflowX:'auto'}}><table>
        <thead><tr><th>Registered company</th><th>Number</th><th>Status</th><th>Review</th></tr></thead>
        <tbody>{registeredMembers.map(item=><tr key={item.id}>
          <td>{item.name}</td><td>{item.company_number??'—'}</td><td>{item.status}</td>
          <td><button type="button" onClick={()=>onPopulate({
            legal_name:item.name??'',company_number:item.company_number??'',
            source_reference:item.source_reference,
          })}>Prefill identity only</button>
            <button type="button" onClick={()=>setSourceCandidate({
              source_type:'existing_customer',source_id:item.id,legal_name:item.name??'',
              company_number:item.company_number??'',website:'',verified_source_url:'',
              relationship_evidence:'',legal_form:'unknown',segment:'customer',
            })}>Review relationship and capture</button></td>
        </tr>)}</tbody>
      </table></div>}
      <p>To classify an existing customer, verify separate commercial evidence and choose the appropriate provenance type in the prospect form.</p>
    </SuperAdminSectionCard>

    {sourceCandidate && <SuperAdminSectionCard title="Verify internal source before CRM capture">
      <p>Selected source: {sourceCandidate.source_type==='inbound_enquiry'?'XDrive public service enquiry':'Registered XDrive member'} — {sourceCandidate.source_id}.</p>
      <p>Neither an enquiry nor registration proves commercial consent or a completed booking.
        Confirm the legal entity and independent business-source evidence before capturing.</p>
      <div style={note}>
        <label>Independently verified legal business name
          <input required maxLength={240} value={sourceCandidate.legal_name}
            onChange={e=>setSourceCandidate({...sourceCandidate,legal_name:e.target.value})}/>
        </label>
        <label>Registered company number
          <input maxLength={32} value={sourceCandidate.company_number}
            onChange={e=>setSourceCandidate({...sourceCandidate,company_number:e.target.value})}/>
        </label>
        <label>Verified official company record or public business website (HTTPS)
          <input required type="url" value={sourceCandidate.verified_source_url}
            onChange={e=>setSourceCandidate({...sourceCandidate,verified_source_url:e.target.value})}/>
        </label>
        <label>Company website, if known (HTTPS)
          <input type="url" value={sourceCandidate.website}
            onChange={e=>setSourceCandidate({...sourceCandidate,website:e.target.value})}/>
        </label>
        <label>Entity classification
          <select value={sourceCandidate.legal_form}
            onChange={e=>setSourceCandidate({...sourceCandidate,legal_form:e.target.value})}>
            {['ltd','llp','sole_trader','other','unknown'].map(value=><option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Commercial segment
          <select value={sourceCandidate.segment}
            onChange={e=>setSourceCandidate({...sourceCandidate,segment:e.target.value})}>
            {['customer','broker','forwarder','carrier','mixed'].map(value=><option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Written evidence of the business relationship / origin (40+ characters)
          <textarea minLength={40} maxLength={350} rows={4}
            value={sourceCandidate.relationship_evidence}
            onChange={e=>setSourceCandidate({...sourceCandidate,relationship_evidence:e.target.value})}/>
        </label>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button type="button" disabled={readOnly || working ||
            sourceCandidate.legal_name.trim().length<2 ||
            sourceCandidate.relationship_evidence.trim().length<40 ||
            !sourceCandidate.verified_source_url ||
            !(sourceCandidate.company_number || sourceCandidate.website)}
            onClick={()=>void captureInternalSource()}>Save reviewed source as CRM prospect</button>
          <button type="button" onClick={()=>setSourceCandidate(null)}>Cancel review</button>
        </div>
      </div>
    </SuperAdminSectionCard>}

    <SuperAdminSectionCard title="Owner-reviewed CSV research — preview first">
      <p>Headers: legal_name,company_number,website,legal_form,segment,source_url. Up to 100 organisations; no contact-person import.</p>
      <textarea rows={6} style={{width:'100%',maxWidth:850}} value={csv} onChange={e=>{setCsv(e.target.value);setCsvPreview(null);setCsvConfirmed(false);}} />
      <p><button type="button" disabled={working || readOnly} onClick={()=>void previewCsv()}>Validate CSV without writes</button></p>
      {csvPreview && <>
        <p>Valid: {csvPreview.valid}/{csvPreview.total}. Writes: {csvPreview.writes}.</p>
        {!csvPreview.preview_token && <p>Signed preview unavailable: the staging import-signing secret may not be configured. Import stays locked.</p>}
        <ul>{csvPreview.rows.filter(x=>!x.valid).map(x=><li key={x.row}>Row {x.row}: {x.errors.join(', ')}</li>)}</ul>
        <label><input type="checkbox" checked={csvConfirmed} disabled={readOnly} onChange={e=>setCsvConfirmed(e.target.checked)}/> I have reviewed every source and confirm these are permitted, accurate business records.</label>
        <p><button type="button" disabled={readOnly || working || !csvConfirmed || !csvPreview.preview_token || csvPreview.total!==csvPreview.valid} onClick={()=>void importCsv()}>Stage reviewed organisations (no contact import)</button></p>
      </>}
    </SuperAdminSectionCard>

    {selected && <SuperAdminSectionCard title={'Owner, priority and follow-up — '+selected.legal_name}>
      <form onSubmit={saveOrg} style={note}>
        <label>Legal name <input required value={edit.legal_name} onChange={e=>setEdit({...edit,legal_name:e.target.value})}/></label>
        <label>Company number <input value={edit.company_number} onChange={e=>setEdit({...edit,company_number:e.target.value})}/></label>
        <label>Website <input type="url" value={edit.website} onChange={e=>setEdit({...edit,website:e.target.value})}/></label>
        <label>Segment <select value={edit.segment} onChange={e=>setEdit({...edit,segment:e.target.value})}>{['customer','broker','forwarder','carrier','mixed'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Legal form <select value={edit.legal_form} onChange={e=>setEdit({...edit,legal_form:e.target.value})}>{['ltd','llp','sole_trader','other','unknown'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Source channel <select value={edit.source_type} onChange={e=>setEdit({...edit,source_type:e.target.value})}>{sourceTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Source reference ID / relationship evidence <input value={edit.source_reference} maxLength={500} onChange={e=>setEdit({...edit,source_reference:e.target.value})}/></label>
        <label>Verified source (HTTPS) <input required type="url" value={edit.source_url} onChange={e=>setEdit({...edit,source_url:e.target.value})}/></label>
        <label>Priority <select value={edit.priority} onChange={e=>setEdit({...edit,priority:e.target.value})}>{['low','normal','high'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Next follow-up <input type="datetime-local" value={edit.next_follow_up_at} onChange={e=>setEdit({...edit,next_follow_up_at:e.target.value})}/></label>
        <label>Assigned active Platform Owner UUID <input value={edit.owner_user_id} onChange={e=>setEdit({...edit,owner_user_id:e.target.value})}/></label>
        <label>Audit note <textarea rows={2} maxLength={1000} value={edit.note} onChange={e=>setEdit({...edit,note:e.target.value})}/></label>
        <button type="submit" disabled={readOnly || working}>Save prospect / follow-up changes</button>
      </form>
    </SuperAdminSectionCard>}

    {selected && <SuperAdminSectionCard title="Contact compliance and retention review">
      <label>Select business contact <select value={contactId} onChange={e=>loadContact(e.target.value)}>
        <option value="">Select</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.person_name??c.business_email??c.business_phone??c.id}</option>)}
      </select></label>
      {contactForm && <form onSubmit={saveContact} style={note}>
        <label>Business contact name <input value={contactForm.person_name??''} onChange={e=>setContactForm({...contactForm,person_name:e.target.value})}/></label>
        <label>Job title <input value={contactForm.job_title??''} onChange={e=>setContactForm({...contactForm,job_title:e.target.value})}/></label>
        <label>Email <input type="email" value={contactForm.business_email??''} onChange={e=>setContactForm({...contactForm,business_email:e.target.value})}/></label>
        <label>Phone +E.164 <input value={contactForm.business_phone??''} onChange={e=>setContactForm({...contactForm,business_phone:e.target.value})}/></label>
        <label>Kind <select value={contactForm.contact_kind} onChange={e=>setContactForm({...contactForm,contact_kind:e.target.value})}>
          {['generic_business','named_person','unknown'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Lawful basis <select value={contactForm.lawful_basis} onChange={e=>setContactForm({...contactForm,lawful_basis:e.target.value})}>
          {['undetermined','legitimate_interests','consent','other'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Lawful basis evidence <textarea maxLength={2000} value={contactForm.lawful_basis_evidence??''} onChange={e=>setContactForm({...contactForm,lawful_basis_evidence:e.target.value})}/></label>
        <label>Source URL <input type="url" value={contactForm.source_url} onChange={e=>setContactForm({...contactForm,source_url:e.target.value})}/></label>
        <label><input type="checkbox" checked={contactForm.corporate_subscriber_verified} onChange={e=>setContactForm({...contactForm,corporate_subscriber_verified:e.target.checked})}/> Corporate subscriber verified</label>
        <label><input type="checkbox" checked={contactForm.lia_approved} onChange={e=>setContactForm({...contactForm,lia_approved:e.target.checked})}/> Documented LIA approved</label>
        <label><input type="checkbox" checked={!!contactForm.tps_ctps_checked_at} onChange={e=>setContactForm({...contactForm,tps_ctps_checked_at:e.target.checked?new Date().toISOString():null})}/> TPS/CTPS check recorded</label>
        <label><input type="checkbox" checked={contactForm.tps_ctps_blocked} onChange={e=>setContactForm({...contactForm,tps_ctps_blocked:e.target.checked})}/> TPS/CTPS blocks call</label>
        <label><input type="checkbox" checked={!!contactForm.first_notice_sent_at} onChange={e=>setContactForm({...contactForm,first_notice_sent_at:e.target.checked?new Date().toISOString():null})}/> Privacy notice actually delivered (manual evidence)</label>
        <label>Compliance evidence / audit note <textarea value={contactReview} onChange={e=>setContactReview(e.target.value)} minLength={10}/></label>
        <button type="submit" disabled={readOnly || working}>Save verified contact evidence</button>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button type="button" onClick={()=>void checkEligibility('email')} disabled={working}>Review email eligibility</button>
          <button type="button" onClick={()=>void checkEligibility('phone')} disabled={working}>Review phone eligibility</button>
        </div>
        {eligibility && <p>{eligibility}</p>}
        <label>Retention review reason <textarea value={contactRetentionNote} onChange={e=>setContactRetentionNote(e.target.value)} minLength={20}/></label>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button type="button" disabled={readOnly || working} onClick={()=>void retentionAction('active')}>Reviewed: retain</button>
          <button type="button" disabled={readOnly || working} onClick={()=>void retentionAction('archived')}>Reviewed: archive</button>
        </div>
      </form>}
    </SuperAdminSectionCard>}

    <SuperAdminSectionCard title="Campaign drafts — no sending API">
      <form onSubmit={createDraft} style={note}>
        <label>Draft name <input required value={campaign.name} onChange={e=>setCampaign({...campaign,name:e.target.value})}/></label>
        <label>Audience <select value={campaign.segment} onChange={e=>setCampaign({...campaign,segment:e.target.value})}>{['customer','broker','forwarder','carrier','mixed'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Channel <select value={campaign.channel} onChange={e=>setCampaign({...campaign,channel:e.target.value})}><option>email</option><option>phone</option></select></label>
        <label>Subject <input value={campaign.subject} onChange={e=>setCampaign({...campaign,subject:e.target.value})}/></label>
        <label>Message / script <textarea required rows={5} maxLength={6000} value={campaign.body} onChange={e=>setCampaign({...campaign,body:e.target.value})}/></label>
        <button type="submit" disabled={readOnly || working}>Save private draft</button>
      </form>
      <label>Existing draft <select value={selectedDraftId} onChange={e=>{setSelectedDraftId(e.target.value);setCampaignAudience(null);
        const draft=drafts.find(x=>x.id===e.target.value);
        if(draft)setCampaign({name:draft.name,segment:draft.segment,channel:draft.channel,subject:draft.subject??'',body:draft.body});
      }}><option value="">Select</option>{drafts.map(d=><option key={d.id} value={d.id}>{d.name} — {d.status}</option>)}</select></label>
      <label>Legal review evidence <textarea value={approvalEvidence} onChange={e=>setApprovalEvidence(e.target.value)} maxLength={2000}/></label>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button type="button" disabled={readOnly || working || !selectedDraftId} onClick={()=>void campaignAction('edit')}>Save draft edits</button>
        <button type="button" disabled={readOnly || working || !selectedDraftId} onClick={()=>void campaignAction('approve')}>Approve content only</button>
        <button type="button" disabled={readOnly || working || !selectedDraftId} onClick={()=>void campaignAction('archive')}>Archive</button>
        <button type="button" disabled={readOnly || working || !selectedDraftId} onClick={()=>void campaignAction('reopen')}>Reopen</button>
      </div>
      <p>Content approval does not authorise an email, call, schedule or bulk dispatch.</p>
      <button type="button" disabled={working || !selectedDraftId} onClick={()=>void previewCampaignAudience()}>
        Review suppression-screened audience (no export or sending)
      </button>
      {campaignAudience && <div>
        <p>Reviewed: {campaignAudience.scanned_organisations} companies and {campaignAudience.scanned_contacts} business contacts.</p>
        <p>Passed preliminary manual legal review: {campaignAudience.eligible_for_manual_legal_review}; blocked: {campaignAudience.blocked}.</p>
        {campaignAudience.incomplete && <p role="alert">Preview is a bounded sample, not the full audience. No dispatch can follow from this sample.</p>}
        <ul>{Object.entries(campaignAudience.reasons).map(([reason,count])=>
          <li key={reason}>{reason}: {count}</li>)}</ul>
        <p>No contact list is exported. Every real contact still requires independent legal review.</p>
      </div>}
    </SuperAdminSectionCard>

    <SuperAdminSectionCard title="Data subject access, objection and erasure">
      <form onSubmit={privacyCreate} style={note}>
        <label>Contact <select value={privacyContactId} onChange={e=>setPrivacyContactId(e.target.value)} required>
          <option value="">Select contact from open prospect</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.person_name??c.business_email??c.id}</option>)}
        </select></label>
        <label>Request type <select value={privacyType} onChange={e=>setPrivacyType(e.target.value)}>
          <option value="access">Access / export</option><option value="erasure">Erasure</option><option value="objection">Marketing objection — immediate suppression</option>
        </select></label>
        <label>Request received and identity-check evidence <textarea required value={privacyNote} onChange={e=>setPrivacyNote(e.target.value)}/></label>
        <button type="submit" disabled={readOnly || working}>Record privacy request</button>
      </form>
      <label>Decision evidence <textarea rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} maxLength={2000}/></label>
      <label><input type="checkbox" checked={requesterVerified} onChange={e=>setRequesterVerified(e.target.checked)}/> Requester identity independently verified</label>
      <label>Erasure legal-hold review <select value={holdDecision} onChange={e=>setHoldDecision(e.target.value)}>
        <option value="unchecked">Not reviewed</option><option value="no">No legal hold — independently verified</option>
        <option value="yes">Active legal hold — do not erase</option>
      </select></label>
      <label>For erasure only, type ERASE_CONTACT <input value={eraseConfirmed} onChange={e=>setEraseConfirmed(e.target.value)}/></label>
      {privacy.length===0?<p>No privacy requests recorded.</p>:<ul>{privacy.map(r=><li key={r.id}>
        {r.request_type} — {r.status} — {r.id}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button type="button" disabled={readOnly || working || r.status!=='received'} onClick={()=>void privacyAction(r.id,'review')}>Review</button>
          {r.request_type==='erasure' && <button type="button"
            disabled={readOnly || working || r.status!=='reviewing' || holdDecision==='unchecked'}
            onClick={()=>void privacyAction(r.id,'hold_review')}>Record legal-hold review</button>}
          <button type="button" disabled={readOnly || working || r.status!=='reviewing'} onClick={()=>void privacyAction(r.id,'approve')}>Approve after identity verification</button>
          <button type="button" disabled={readOnly || working || !['received','reviewing'].includes(r.status)} onClick={()=>void privacyAction(r.id,'reject')}>Reject with reason</button>
          {r.request_type==='access' && <button type="button" disabled={working || r.status!=='approved'} onClick={()=>void privacyExport(r.id)}>Prepare reviewed export</button>}
          {r.request_type==='access' && <button type="button" disabled={readOnly || working || r.status!=='approved'} onClick={()=>void privacyAction(r.id,'fulfil_access')}>Mark delivered</button>}
          {r.request_type==='erasure' && <button type="button" disabled={readOnly || working || r.status!=='approved' || eraseConfirmed!=='ERASE_CONTACT'} onClick={()=>void privacyAction(r.id,'execute_erasure')}>Execute approved erasure</button>}
        </div>
      </li>)}</ul>}
      {exportValue && <textarea readOnly aria-label="Reviewed data export JSON" rows={9} style={{width:'100%'}} value={exportValue}/>}
    </SuperAdminSectionCard>

    {selected && <SuperAdminSectionCard title="Verified member conversion — not a fake booking">
      <form onSubmit={conversion} style={note}>
        <label>Existing active member company UUID <input required value={conversionCompanyId} onChange={e=>setConversionCompanyId(e.target.value)}/></label>
        <label>Verified identity / onboarding evidence <textarea required minLength={30} maxLength={1000} value={conversionEvidence} onChange={e=>setConversionEvidence(e.target.value)}/></label>
        <button type="submit" disabled={readOnly || working || selected.status==='converted'}>Link verified active member</button>
      </form>
      <p>Company must exist and be active, with matching legal name or company number. No conversion from an unverified self-reported record.</p>
    </SuperAdminSectionCard>}
  </>;
}
