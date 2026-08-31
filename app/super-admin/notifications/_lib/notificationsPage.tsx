'use client';

import React from 'react';
import Link from 'next/link';
import type { TableColumn } from '../../_components/SuperAdminLiveTablePage';
import { formatDateTime } from '../../_components/superAdminFormatters';
import { getAuthHeader } from '../../_lib/getAuthHeader';

export type NotificationSeverity = 'Critical' | 'Warning' | 'Info' | 'Success';
export type NotificationRow = {
  id:string;
  user_id:string|null;
  entity_type?:string|null;
  entity_id?:string;
  type:string;
  title:string|null;
  message:string;
  status:string;
  category?:string;
  severity?:NotificationSeverity;
  processed:boolean;
  created_at:string;
  last_error:string|null;
  attempt_count:number|null;
  next_attempt_at:string|null;
  view_href?:string|null;
};
export type RetryFeedback = { tone:'success'|'error'; message:string };

const X = { navy:'#0B2F6B', blue:'#1D57D8', orange:'#F5A300', white:'#FFFFFF', charcoal:'#1A1F2B', light:'#F4F6F8', border:'#D9E1EA', muted:'#64748B', danger:'#DC2626', success:'#16A34A' } as const;
export const notificationsTableProps = { icon:'🔔', title:'Notification Centre', sectionLabel:'Platform', description:'Operational notifications with canonical entity provenance, category, severity, delivery state and recovery actions.', summaryField:'summary', noteField:'note', diagnosticField:'diagnosticNote', emptyMessage:'No notifications match the selected filters.' } as const;

export async function performNotificationRetry({notificationId,reason,getAuthHeaderImpl=getAuthHeader,fetchImpl=fetch,onSuccess}:{notificationId:string;reason:string;getAuthHeaderImpl?:typeof getAuthHeader;fetchImpl?:typeof fetch;onSuccess?:()=>void|Promise<void>}):Promise<RetryFeedback>{
  if (typeof window !== 'undefined' && window.location.hostname.startsWith('deploy-preview-')) {
    return { tone:'error', message:'Deploy Preview is read-only. Notification retry is disabled.' };
  }
  const normalizedReason=reason.trim();
  if(normalizedReason.length<5)return{tone:'error',message:'A retry reason of at least 5 characters is required.'};
  const auth=await getAuthHeaderImpl();
  if(!auth)return{tone:'error',message:'Authentication session is unavailable.'};
  let response:Response;
  try{
    response=await fetchImpl('/api/super-admin/platform',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({section:'notifications',action:'retry',notificationId,reason:normalizedReason})});
  }catch{
    return{tone:'error',message:'Notification retry is currently unavailable.'};
  }
  const body = await response.json().catch(()=>null) as { code?: string } | null;
  if(!response.ok){
    if (body?.code === 'preview_mutation_disabled') return { tone:'error', message:'Deploy Preview is read-only. Notification retry is disabled.' };
    return{tone:'error',message:'Notification retry is currently unavailable.'};
  }
  await onSuccess?.();
  return{tone:'success',message:'Retry queued and audited.'};
}

const severityColor:Record<NotificationSeverity,string>={Critical:X.danger,Warning:X.orange,Info:X.blue,Success:X.success};
const fallbackSeverity=(row:NotificationRow):NotificationSeverity=>row.status==='failed'?'Critical':row.status==='pending'?'Warning':row.status==='sent'?'Success':'Info';
const actionStyle={height:'32px',display:'grid',placeItems:'center',padding:'0 10px',borderRadius:'4px',fontSize:'11px',fontWeight:700,textDecoration:'none'} as const;

export function createNotificationColumns({pendingById,feedbackById,onRetry,previewReadOnly=false}:{pendingById:Record<string,boolean>;feedbackById:Record<string,RetryFeedback|undefined>;onRetry:(notificationId:string)=>void|Promise<void>;previewReadOnly?:boolean}):TableColumn<NotificationRow>[] { return [
  {key:'notification',label:'Notification',render:(row)=><div style={{minWidth:'220px'}}><div style={{fontSize:'12px',fontWeight:row.processed?600:800,color:X.charcoal}}>{row.title??'(no title)'}</div><div style={{fontSize:'11px',color:X.muted,marginTop:'2px',lineHeight:1.4}}>{row.message}</div>{row.entity_type&&row.entity_id?<div style={{fontSize:'9px',color:X.muted,marginTop:'3px'}}><span style={{fontWeight:800,textTransform:'uppercase'}}>{row.entity_type}</span> · <code>{row.entity_id}</code></div>:null}</div>},
  {key:'category',label:'Category',render:(row)=><span style={{fontSize:'10px',fontWeight:700,color:X.navy,background:'#EEF4FF',border:`1px solid ${X.border}`,borderRadius:'4px',padding:'3px 6px'}}>{row.category??'Platform'}</span>},
  {key:'severity',label:'Severity',render:(row)=>{const severity=row.severity??fallbackSeverity(row);const color=severityColor[severity];return <span style={{fontSize:'10px',fontWeight:800,color,border:`1px solid ${color}55`,borderRadius:'4px',padding:'3px 6px',background:X.white}}>{severity}</span>;}},
  {key:'status',label:'Delivery',render:(row)=><span style={{fontSize:'11px',fontWeight:700,color:row.status==='failed'?X.danger:row.status==='pending'?X.orange:row.status==='sent'?X.success:X.muted}}>{row.status}</span>},
  {key:'failure_detail',label:'Delivery detail',render:(row)=>{
    if (!row.last_error) return <span style={{fontSize:'11px',color:X.muted}}>—</span>;
    const heading = row.status === 'skipped' ? 'Skipped / quarantined' : row.status === 'failed' ? 'Delivery failed' : 'Delivery note';
    const headingColor = row.status === 'failed' ? X.danger : row.status === 'skipped' ? X.orange : X.muted;
    return <div style={{fontSize:'10px',color:X.muted,maxWidth:'320px',lineHeight:1.4}}><div style={{color:headingColor,fontWeight:700}}>{heading}</div><div style={{marginTop:'2px',color:X.charcoal}}>{row.last_error}</div><div style={{marginTop:'2px'}}>Attempts: {row.attempt_count??'—'} {row.next_attempt_at?`· next ${formatDateTime(row.next_attempt_at)}`:''}</div></div>;
  }},
  {key:'created_at',label:'Created',render:(row)=><span style={{fontSize:'11px',whiteSpace:'nowrap'}}>{formatDateTime(row.created_at)}</span>},
  {key:'actions',label:'Actions',render:(row)=>{
    const retryState=row.status==='failed'||row.status==='skipped';
    const eligible=retryState&&!previewReadOnly;
    const pending=pendingById[row.id]===true;
    const feedback=feedbackById[row.id];
    return <div style={{display:'flex',gap:'6px',alignItems:'center',minWidth:'180px',flexWrap:'wrap'}}>
      {row.view_href&&<Link href={row.view_href} style={{...actionStyle,border:`1px solid ${X.blue}`,background:X.blue,color:X.white}}>View</Link>}
      <button type='button' disabled={!eligible||pending} onClick={()=>{void onRetry(row.id);}} title={previewReadOnly&&retryState?'Deploy Preview is read-only. Retry is available only outside preview.':undefined} style={{...actionStyle,border:`1px solid ${eligible&&!pending?X.blue:X.border}`,background:eligible&&!pending?X.white:X.light,color:eligible&&!pending?X.blue:'#9CA3AF',cursor:eligible&&!pending?'pointer':'not-allowed'}}>{pending?'Retrying…':previewReadOnly&&retryState?'Retry · preview':'Retry'}</button>
      {feedback&&<div style={{fontSize:'10px',color:feedback.tone==='success'?X.success:X.danger}}>{feedback.message}</div>}
    </div>;
  }}
]; }
