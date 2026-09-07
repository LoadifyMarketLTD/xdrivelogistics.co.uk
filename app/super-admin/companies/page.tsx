'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';

type Company = { id:string; name:string; company_number:string|null; email:string|null; status:string; company_type:string|null; created_at:string; };
type AuditRow = { id:string; target_company_id:string; action_type:string; old_status?:string; new_status?:string; reason?:string; created_at:string; };
type ActionType = 'approve' | 'reject' | 'suspend' | 'reinstate';
type Pagination = { page:number; limit:number; total:number; totalPages:number; hasNextPage:boolean; hasPrevPage:boolean; };
type ApiResponse = { companies:Company[]; pagination:Pagination; governanceHistoryAvailable?:boolean; governanceHistoryError?:string|null; governanceHistoryByCompany?:Record<string,AuditRow[]>; governanceHistoryRecent?:AuditRow[]; };
type CompanySummary = { refreshedAt:string; total:number; active:number; suspended:number; pending:number; rejected:number; };

const THEME={pageBg:'#F4F6F8',cardBg:'#FFFFFF',cardBorder:'#D9E1EA',text:'#1A1F2B',heading:'#0B2F6B',blue:'#1D57D8',muted:'#64748B',accent:'#F5A300',green:'#16A34A',red:'#DC2626'} as const;
const PAGE_SIZE=50;
const REQUEST_TIMEOUT_MS=12_000;

const isPendingCompanyStatus=(status:string)=>['pending','pending_approval'].includes(status.toLowerCase());
const getActionsForStatus=(status:string):ActionType[]=>isPendingCompanyStatus(status)?['approve','reject']:status.toLowerCase()==='active'?['suspend']:status.toLowerCase()==='suspended'?['reinstate']:[];
const isSummary=(value:unknown):value is CompanySummary=>{
  if(!value||typeof value!=='object') return false;
  const row=value as Record<string,unknown>;
  return typeof row.refreshedAt==='string'&&['total','active','suspended','pending','rejected'].every((key)=>typeof row[key]==='number'&&Number.isFinite(row[key] as number));
};
const isPagination=(value:unknown):value is Pagination=>{
  if(!value||typeof value!=='object') return false;
  const row=value as Record<string,unknown>;
  return ['page','limit','total','totalPages'].every((key)=>typeof row[key]==='number')&&typeof row.hasNextPage==='boolean'&&typeof row.hasPrevPage==='boolean';
};

export default function Page(){
  const[companies,setCompanies]=useState<Company[]>([]);
  const[summary,setSummary]=useState<CompanySummary|null>(null);
  const[pagination,setPagination]=useState<Pagination|null>(null);
  const[page,setPage]=useState(1);
  const[searchInput,setSearchInput]=useState('');
  const[search,setSearch]=useState('');
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState<string|null>(null);
  const[message,setMessage]=useState<string|null>(null);
  const[acting,setActing]=useState<{companyId:string;action:ActionType}|null>(null);
  const[pendingModal,setPendingModal]=useState<{company:Company;action:ActionType}|null>(null);
  const[governanceHistoryAvailable,setGovernanceHistoryAvailable]=useState(false);
  const[governanceHistoryError,setGovernanceHistoryError]=useState<string|null>(null);
  const[governanceHistoryByCompany,setGovernanceHistoryByCompany]=useState<Record<string,AuditRow[]>>({});
  const[governanceHistoryRecent,setGovernanceHistoryRecent]=useState<AuditRow[]>([]);
  const generationRef=useRef(0);

  const fetchCompanies=useCallback(async()=>{
    const generation=++generationRef.current;
    setLoading(true);setError(null);setCompanies([]);setSummary(null);setPagination(null);setGovernanceHistoryAvailable(false);setGovernanceHistoryError(null);setGovernanceHistoryByCompany({});setGovernanceHistoryRecent([]);
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const auth=await getAuthHeader();
      if(generation!==generationRef.current)return;
      if(!auth){setError('No active Platform Owner session.');return;}
      const params=new URLSearchParams({status:'all',page:String(page),limit:String(PAGE_SIZE)});
      if(search)params.set('search',search);
      const[listRes,summaryRes]=await Promise.all([
        fetch(`/api/super-admin/companies?${params.toString()}`,{headers:{Authorization:auth},signal:controller.signal,cache:'no-store'}),
        fetch('/api/super-admin/companies/summary',{headers:{Authorization:auth},signal:controller.signal,cache:'no-store'}),
      ]);
      const[listBody,summaryBody]=await Promise.all([listRes.json().catch(()=>({})),summaryRes.json().catch(()=>({}))]);
      if(generation!==generationRef.current)return;
      if(!listRes.ok){setError((listBody as {error?:string}).error??`Company register unavailable (${listRes.status}).`);return;}
      if(!summaryRes.ok){setError((summaryBody as {error?:string}).error??`Company summary unavailable (${summaryRes.status}).`);return;}
      const list=listBody as ApiResponse;
      if(!Array.isArray(list.companies)||!isPagination(list.pagination)||!isSummary(summaryBody)){setError('Company governance returned an incomplete snapshot. No totals were inferred.');return;}
      setCompanies(list.companies);setPagination(list.pagination);setSummary(summaryBody);
      setGovernanceHistoryAvailable(Boolean(list.governanceHistoryAvailable));setGovernanceHistoryError(list.governanceHistoryError??null);setGovernanceHistoryByCompany(list.governanceHistoryByCompany??{});setGovernanceHistoryRecent(list.governanceHistoryRecent??[]);
    }catch(err){setError(err instanceof DOMException&&err.name==='AbortError'?'Company governance timed out. No stale data is being shown.':'Company governance service is currently unavailable.');}
    finally{window.clearTimeout(timeout);if(generation===generationRef.current)setLoading(false);}
  },[page,search]);

  useEffect(()=>{void fetchCompanies();return()=>{generationRef.current+=1;};},[fetchCompanies]);

  const handleAction=async(companyId:string,action:ActionType,reason='')=>{
    setActing({companyId,action});setMessage(null);
    try{const auth=await getAuthHeader();if(!auth){setMessage('No active session.');return;}const res=await fetch(`/api/super-admin/companies/${companyId}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({action,...(reason?{reason}:{})})});const body=await res.json().catch(()=>({}));if(!res.ok)setMessage((body as {error?:string}).error??'The requested company action could not be completed.');else{setMessage(`Action '${action}' applied successfully.`);await fetchCompanies();}}catch{setMessage('The requested company action could not be completed.');}finally{setActing(null);}
  };
  const initiateAction=(company:Company,action:ActionType)=>{if(action==='suspend'||action==='reject')setPendingModal({company,action});else void handleAction(company.id,action);};
  const applySearch=(event:FormEvent)=>{event.preventDefault();setPage(1);setSearch(searchInput.trim());};

  const cards: Array<[string,number|null]>=[['Total',summary?.total??null],['Active',summary?.active??null],['Suspended',summary?.suspended??null],['Pending',summary?.pending??null],['Rejected',summary?.rejected??null]];

  return <ProtectedRoute allowedRoles={['owner']}>
    <ActionConfirmModal open={pendingModal!==null} title={pendingModal?.action==='suspend'?'⛔ Suspend company':'❌ Reject company'} description={pendingModal?.action==='suspend'?<><strong>{pendingModal.company.name}</strong> will be suspended immediately. Drivers and brokers in this company will lose platform access.</>:<><strong>{pendingModal?.company.name}</strong> application will be rejected.</>} confirmLabel={pendingModal?.action==='suspend'?'Confirm suspension':'Confirm rejection'} danger reasonRequired reasonPlaceholder='Record the governance reason…' submitting={acting!==null} onCancel={()=>setPendingModal(null)} onConfirm={(reason)=>{if(!pendingModal)return;const next=pendingModal;setPendingModal(null);void handleAction(next.company.id,next.action,reason);}} />
    <div style={{minHeight:'100vh',backgroundColor:THEME.pageBg,color:THEME.text,padding:'12px'}}>
      <header style={{minHeight:'52px',display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px',flexWrap:'wrap'}}><span aria-hidden='true' style={{width:28,height:28,display:'grid',placeItems:'center',borderRadius:4,background:THEME.heading,color:'#fff'}}>🏢</span><div style={{flex:1}}><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><h1 style={{fontSize:20,fontWeight:800,color:THEME.heading,margin:0}}>All Companies Governance</h1><span style={{fontSize:10,fontWeight:800,textTransform:'uppercase',color:THEME.blue,background:'#EEF4FF',padding:'3px 6px',borderRadius:4}}>Companies</span></div><p style={{color:THEME.muted,margin:'4px 0 0',fontSize:12}}>Platform-wide company register with exact global counts, governance actions and audit trail.</p>{summary&&<div style={{fontSize:10,color:THEME.muted,marginTop:3}}>Verified snapshot {new Date(summary.refreshedAt).toLocaleString('en-GB')}</div>}</div><button onClick={()=>void fetchCompanies()} disabled={loading} style={{height:32,padding:'0 10px',borderRadius:4,border:`1px solid ${THEME.blue}`,background:THEME.blue,color:'#fff',fontWeight:800,fontSize:11}}>{loading?'Loading…':'Refresh'}</button></header>

      {error&&<div role='alert' data-testid='companies-unavailable' style={{background:THEME.cardBg,border:`1px solid ${THEME.red}`,borderLeft:`4px solid ${THEME.red}`,borderRadius:4,padding:'9px 12px',color:THEME.red,fontSize:11,fontWeight:700,marginBottom:12}}>{error}</div>}
      {!error&&<>
        <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:12}}>{cards.map(([label,value])=><div key={label} style={{minHeight:72,background:THEME.cardBg,border:`1px solid ${THEME.cardBorder}`,borderRadius:4,padding:12}}><div style={{color:THEME.heading,fontSize:20,fontWeight:800}}>{loading?'—':value??'Unavailable'}</div><div style={{color:THEME.muted,fontSize:10,textTransform:'uppercase',letterSpacing:'.04em',marginTop:5,fontWeight:700}}>{label}</div></div>)}</section>
        <form onSubmit={applySearch} style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}><input value={searchInput} onChange={(e)=>setSearchInput(e.target.value)} placeholder='Search name, company number or email…' style={{height:32,minWidth:280,flex:'0 1 420px',border:`1px solid ${THEME.cardBorder}`,borderRadius:4,padding:'0 9px'}}/><button type='submit' disabled={loading} style={{height:32,border:`1px solid ${THEME.blue}`,borderRadius:4,background:'#fff',color:THEME.blue,fontWeight:800,padding:'0 12px'}}>Search</button>{search&&<button type='button' onClick={()=>{setSearchInput('');setSearch('');setPage(1);}} style={{height:32,border:`1px solid ${THEME.cardBorder}`,borderRadius:4,background:'#fff',color:THEME.heading,fontWeight:700,padding:'0 12px'}}>Clear</button>}</form>
        {message&&<div style={{background:THEME.cardBg,border:`1px solid ${THEME.accent}`,borderLeft:`4px solid ${THEME.accent}`,borderRadius:4,padding:'9px 12px',fontSize:11,marginBottom:12}}>{message}</div>}
        <section style={{background:THEME.cardBg,border:`1px solid ${THEME.cardBorder}`,borderRadius:4,overflow:'hidden',marginBottom:12}}>{loading?<div style={{padding:18,textAlign:'center',color:THEME.muted}}>Loading verified company page…</div>:companies.length===0?<div style={{padding:18,textAlign:'center',color:THEME.muted}}>No companies match this view.</div>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:1080,fontSize:12}}><thead><tr style={{height:38,background:THEME.pageBg,borderBottom:`1px solid ${THEME.cardBorder}`}}>{['Company','Status','Type','Email','Created','Governance actions','Audit history','Inspect'].map((heading)=><th key={heading} style={{padding:'0 12px',textAlign:'left',color:THEME.heading,fontWeight:800,fontSize:10,textTransform:'uppercase',whiteSpace:'nowrap'}}>{heading}</th>)}</tr></thead><tbody>{companies.map((company)=>{const actions=getActionsForStatus(company.status);const history=governanceHistoryByCompany[company.id]??[];return <tr key={company.id} style={{borderBottom:`1px solid ${THEME.cardBorder}`}}><td style={{padding:'9px 12px'}}><strong>{company.name}</strong><div style={{fontSize:10,color:THEME.muted}}>Reg: {company.company_number??'—'}</div></td><td style={{padding:'9px 12px'}}><StatusChip value={company.status}/></td><td style={{padding:'9px 12px'}}>{company.company_type??'standard'}</td><td style={{padding:'9px 12px'}}>{company.email??'—'}</td><td style={{padding:'9px 12px'}}>{formatDateTime(company.created_at)}</td><td style={{padding:'9px 12px'}}><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{actions.length===0?<span style={{color:THEME.muted}}>No action</span>:actions.map((action)=>{const danger=action==='reject'||action==='suspend';return <button key={action} onClick={()=>initiateAction(company,action)} disabled={Boolean(acting)} style={{height:30,padding:'0 9px',borderRadius:4,border:`1px solid ${danger?THEME.red:THEME.green}`,background:'#fff',color:danger?THEME.red:THEME.green,fontWeight:800,fontSize:10}}>{acting?.companyId===company.id&&acting.action===action?'…':action}</button>;})}</div></td><td style={{padding:'9px 12px'}}>{governanceHistoryAvailable?(history.length?history.slice(0,3).map((entry)=><div key={entry.id} style={{fontSize:10}}><strong style={{color:THEME.blue}}>{entry.action_type}</strong><span style={{color:THEME.muted}}> · {formatDateTime(entry.created_at)}</span></div>):<span style={{color:THEME.muted}}>No entries</span>):<span style={{color:THEME.muted}}>Unavailable</span>}</td><td style={{padding:'9px 12px'}}><PlatformEntityLink entityType='company' entityId={company.id} compact>Inspect</PlatformEntityLink></td></tr>;})}</tbody></table></div>}</section>
        {pagination&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12,flexWrap:'wrap',fontSize:11,color:THEME.muted}}><span>Page {pagination.page} of {Math.max(pagination.totalPages,1)} · {pagination.total} matching record(s)</span><div style={{display:'flex',gap:6}}><button type='button' disabled={!pagination.hasPrevPage||loading} onClick={()=>setPage((value)=>Math.max(1,value-1))}>← Previous</button><button type='button' disabled={!pagination.hasNextPage||loading} onClick={()=>setPage((value)=>value+1)}>Next →</button></div></div>}
        <section style={{background:THEME.cardBg,border:`1px solid ${THEME.cardBorder}`,borderRadius:4,padding:12}}><h2 style={{margin:'0 0 8px',color:THEME.heading,fontSize:13,fontWeight:800}}>Recent Governance Events</h2>{!governanceHistoryAvailable?<p style={{margin:0,color:THEME.muted,fontSize:11}}>Governance history is unavailable.{governanceHistoryError?' Diagnostics are available server-side.':''}</p>:governanceHistoryRecent.length===0?<p style={{margin:0,color:THEME.muted,fontSize:11}}>No governance events recorded.</p>:<div style={{display:'flex',flexDirection:'column',gap:6}}>{governanceHistoryRecent.slice(0,12).map((event)=><div key={event.id} style={{fontSize:11}}><strong style={{color:THEME.blue}}>{event.action_type}</strong><span style={{color:THEME.muted}}> · {formatDateTime(event.created_at)}</span>{event.reason&&<span> · {event.reason}</span>}</div>)}</div>}</section>
      </>}
    </div>
  </ProtectedRoute>;
}
