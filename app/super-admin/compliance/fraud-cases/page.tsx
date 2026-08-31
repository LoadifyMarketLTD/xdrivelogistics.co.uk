'use client';

import { useMemo, useState } from 'react';
import SuperAdminLiveTablePage from '@/app/super-admin/_components/SuperAdminLiveTablePage';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';

type FraudAction='investigate'|'clear'|'confirm'|'dismiss';
type Row={id:string;subject_user_id:string|null;subject_company_id:string|null;onboarding_application_id:string|null;matched_user_id:string|null;matched_company_id:string|null;case_type:string;severity:'medium'|'high'|'critical';status:string;automatic_hold:boolean;evidence:Record<string,unknown>;decision_reason:string|null;created_at:string;updated_at:string;applicant_email:string;account_type:string;application_risk_status:string;application_risk_reason:string|null;subject_company_name:string|null;matched_company_name:string|null;};
const X={navy:'#0B2F6B',blue:'#1D57D8',orange:'#F5A300',white:'#FFFFFF',charcoal:'#1A1F2B',light:'#F4F6F8',border:'#D9E1EA',muted:'#64748B',danger:'#DC2626'} as const;
const severityColor:Record<Row['severity'],string>={medium:X.orange,high:'#EA580C',critical:X.danger};
const summarizeEvidence=(evidence:Record<string,unknown>)=>{const entries=Object.entries(evidence).slice(0,4);if(entries.length===0)return'No evidence metadata recorded.';return entries.map(([key,value])=>`${key.replace(/_/g,' ')}: ${String(value??'—')}`).join(' · ');};
const friendlyError=(message:string|undefined,status:number)=>{const raw=message??'';if(/schema cache|relation .* does not exist|fraud_review_cases|public\./i.test(raw))return'Fraud review service is currently unavailable. Technical details have been withheld from this interface.';return raw||`Review failed (${status}).`;};
const actionButton=(tone:'default'|'danger'='default')=>({height:'32px',padding:'0 8px',borderRadius:'4px',border:`1px solid ${tone==='danger'?X.danger:X.border}`,background:X.white,color:tone==='danger'?X.danger:X.navy,fontSize:'11px',fontWeight:700,cursor:'pointer'} as const);

export default function Page(){
 const[reloadToken,setReloadToken]=useState(()=>Date.now());const[busyCaseId,setBusyCaseId]=useState<string|null>(null);const[pendingModal,setPendingModal]=useState<{row:Row;action:FraudAction}|null>(null);const[inlineError,setInlineError]=useState<string|null>(null);
 const reviewCase=async(row:Row,action:FraudAction,reason:string)=>{setBusyCaseId(row.id);setInlineError(null);try{const auth=await getAuthHeader();if(!auth){setInlineError('No active session.');return;}const response=await fetch('/api/super-admin/compliance/fraud-cases',{method:'PATCH',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({caseId:row.id,action,reason:reason.trim()})});if(!response.ok){const payload=await response.json().catch(()=>({})) as {error?:string};setInlineError(friendlyError(payload.error,response.status));return;}setReloadToken(Date.now());}catch{setInlineError('Fraud review service is currently unavailable.');}finally{setBusyCaseId(null);}};
 const initiateAction=(row:Row,action:FraudAction)=>setPendingModal({row,action});
 const columns=useMemo(()=>[
  {key:'identity',label:'Applicant',render:(row:Row)=><div style={{minWidth:'180px'}}><div style={{fontSize:'12px',fontWeight:800,color:X.charcoal}}>{row.applicant_email||'Unknown applicant'}</div><div style={{fontSize:'10px',color:X.muted,marginTop:'2px',textTransform:'capitalize'}}>{row.account_type.replace(/_/g,' ')||'Unknown account type'}</div></div>},
  {key:'companies',label:'Companies',render:(row:Row)=><div style={{minWidth:'160px',fontSize:'11px',color:X.charcoal}}><div>Subject: {row.subject_company_name??'Independent / not linked'}</div><div style={{color:X.muted,marginTop:'2px'}}>Match: {row.matched_company_name??'Unknown / independent'}</div></div>},
  {key:'case',label:'Conflict',render:(row:Row)=><div style={{minWidth:'150px'}}><div style={{textTransform:'capitalize',fontSize:'11px',fontWeight:700}}>{row.case_type.replace(/_/g,' ')}</div><span style={{display:'inline-flex',marginTop:'4px',padding:'3px 6px',borderRadius:'4px',border:`1px solid ${severityColor[row.severity]}`,color:severityColor[row.severity],fontSize:'10px',fontWeight:800,textTransform:'uppercase'}}>{row.severity}</span></div>},
  {key:'evidence',label:'Evidence',render:(row:Row)=><div style={{maxWidth:'360px',fontSize:'11px',lineHeight:1.45,color:X.muted,wordBreak:'break-word'}}>{summarizeEvidence(row.evidence??{})}</div>},
  {key:'status',label:'Status',render:(row:Row)=><div><StatusChip value={row.status}/><div style={{marginTop:'4px'}}><StatusChip value={row.application_risk_status||'clear'}/></div>{row.automatic_hold&&<div style={{marginTop:'4px',color:X.orange,fontSize:'10px',fontWeight:700}}>Automatic hold</div>}</div>},
  {key:'created',label:'Detected',render:(row:Row)=><span style={{fontSize:'11px',color:X.muted}}>{formatDateTime(row.created_at)}</span>},
  {key:'actions',label:'Decision',render:(row:Row)=>{const busy=busyCaseId===row.id;return <div style={{display:'flex',gap:'6px',minWidth:'250px',flexWrap:'wrap'}}><button type='button' disabled={busy} onClick={()=>initiateAction(row,'investigate')} style={actionButton()}>Investigate</button><button type='button' disabled={busy} onClick={()=>initiateAction(row,'clear')} style={actionButton()}>Clear</button><button type='button' disabled={busy} onClick={()=>initiateAction(row,'dismiss')} style={actionButton()}>Dismiss</button><button type='button' disabled={busy} onClick={()=>initiateAction(row,'confirm')} style={actionButton('danger')}>Confirm fraud</button></div>;}}
 ],[busyCaseId]);
 return <>
  {pendingModal&&<ActionConfirmModal open title={pendingModal.action==='confirm'?'Confirm fraud & block':pendingModal.action==='clear'?'Clear identity conflict':pendingModal.action==='dismiss'?'Dismiss fraud alert':'Investigate case'} description={pendingModal.action==='confirm'?<>This will confirm fraud for <strong>{pendingModal.row.applicant_email}</strong>, reject the onboarding application and block access.</>:pendingModal.action==='clear'?<>Clear the identity conflict for <strong>{pendingModal.row.applicant_email}</strong>.</>:pendingModal.action==='dismiss'?<>Dismiss this alert for <strong>{pendingModal.row.applicant_email}</strong>.</>:<>Record an investigation note for <strong>{pendingModal.row.applicant_email}</strong>.</>} confirmLabel={pendingModal.action==='confirm'?'Confirm fraud & block':pendingModal.action==='clear'?'Clear conflict':pendingModal.action==='dismiss'?'Dismiss alert':'Record investigation'} danger={pendingModal.action==='confirm'} reasonRequired reasonLabel='Decision reason (required)' reasonPlaceholder='Provide detailed reasoning for this decision…' submitting={busyCaseId!==null} onCancel={()=>setPendingModal(null)} onConfirm={reason=>{const{row,action}=pendingModal;setPendingModal(null);void reviewCase(row,action,reason);}}/>}
  {inlineError&&<div role='alert' style={{margin:'12px 12px 0',border:`1px solid ${X.danger}`,borderLeft:`4px solid ${X.danger}`,borderRadius:'4px',background:X.white,padding:'10px 12px',color:X.charcoal,fontSize:'11px',display:'flex',justifyContent:'space-between',gap:'8px',alignItems:'center'}}><span>{inlineError}</span><button type='button' onClick={()=>setInlineError(null)} style={{height:'28px',padding:'0 8px',borderRadius:'4px',border:`1px solid ${X.border}`,background:X.white,color:X.navy,cursor:'pointer'}}>Dismiss</button></div>}
  <SuperAdminLiveTablePage<Row>
    icon='🛡️'
    title='Identity & Fraud Review'
    sectionLabel='Compliance'
    description='Duplicate documents and identity conflicts are held automatically. A permanent block requires a recorded Platform Owner decision.'
    endpoint={`/api/super-admin/compliance/fraud-cases?status=all&limit=250&reload=${reloadToken}`}
    summaryField='summary'
    emptyMessage='No identity conflicts or fraud-review cases found.'
    entityLink={(row)=>row.subject_company_id
      ? {entityType:'company',entityId:row.subject_company_id,label:'Company Inspector'}
      : row.subject_user_id
        ? {entityType:'user',entityId:row.subject_user_id,label:'User Inspector'}
        : row.matched_company_id
          ? {entityType:'company',entityId:row.matched_company_id,label:'Matched Company'}
          : row.matched_user_id
            ? {entityType:'user',entityId:row.matched_user_id,label:'Matched User'}
            : null}
    columns={columns}
  />
 </>;
}
