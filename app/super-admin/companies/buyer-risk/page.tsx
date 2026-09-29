'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminDataGrid,
  SuperAdminEmptyState,
  SuperAdminFilterBar,
  SuperAdminMetricCard,
  SuperAdminMetricGrid,
  SuperAdminNotice,
  SuperAdminPage,
  SuperAdminPageHeader,
  SuperAdminSectionCard,
  SuperAdminUnavailableState,
  type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';

type Company = { id:string; name:string; company_number:string|null; email:string|null; status:string; company_type:string|null; created_at:string };
type CompanyList = { companies?:Company[]; error?:string };
type Risk = {
  company_id:string;
  risk_mode:'restricted'|'cleared'|'blocked';
  configured_mode:'restricted'|'cleared'|'blocked';
  is_new_buyer:boolean;
  paid_invoice_count:number;
  active_commitments:number;
  outstanding_exposure_gbp:number;
  projected_amount_gbp:number;
  projected_exposure_gbp:number;
  max_active_commitments:number;
  max_outstanding_exposure_gbp:number;
  allowed:boolean;
  reason:string|null;
  reviewed_by:string|null;
  reviewed_at:string|null;
  review_note:string|null;
};
type RiskEvent = {
  id:string; event_type:string; actor_user_id:string|null; previous_mode:string|null; new_mode:string|null;
  active_commitments:number|null; outstanding_exposure_gbp:number|null; projected_exposure_gbp:number|null;
  reason:string|null; created_at:string;
};
type DetailResponse = { company?:Company; risk?:Risk; events?:RiskEvent[]; error?:string };

const money = (value:number|null|undefined) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(value)) : 'Unavailable';

export default function Page() {
  const [companies,setCompanies] = useState<Company[]>([]);
  const [selectedId,setSelectedId] = useState<string>('');
  const [detail,setDetail] = useState<DetailResponse|null>(null);
  const [loadingList,setLoadingList] = useState(true);
  const [loadingDetail,setLoadingDetail] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [message,setMessage] = useState<string|null>(null);
  const [search,setSearch] = useState('');
  const [mode,setMode] = useState<Risk['risk_mode']>('restricted');
  const [maxActive,setMaxActive] = useState(3);
  const [maxExposure,setMaxExposure] = useState(2500);
  const [reason,setReason] = useState('');

  const loadCompanies = useCallback(async () => {
    setLoadingList(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const response = await fetch('/api/super-admin/companies?status=all&page=1&limit=100',{headers:{Authorization:auth},cache:'no-store'});
      const body = await response.json().catch(()=>({})) as CompanyList;
      if (!response.ok || !Array.isArray(body.companies)) { setError(body.error ?? 'Company list is unavailable.'); return; }
      setCompanies(body.companies);
      if (!selectedId && body.companies.length) setSelectedId(body.companies[0].id);
    } catch { setError('Company list is unavailable.'); }
    finally { setLoadingList(false); }
  },[selectedId]);

  const loadDetail = useCallback(async (companyId:string) => {
    if (!companyId) { setDetail(null); return; }
    setLoadingDetail(true); setError(null); setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const response = await fetch(`/api/super-admin/companies/${companyId}/buyer-risk`,{headers:{Authorization:auth},cache:'no-store'});
      const body = await response.json().catch(()=>({})) as DetailResponse;
      if (!response.ok || !body.risk || !body.company) { setError(body.error ?? 'Buyer-risk snapshot is unavailable.'); setDetail(null); return; }
      setDetail(body);
      setMode(body.risk.configured_mode);
      setMaxActive(body.risk.max_active_commitments);
      setMaxExposure(body.risk.max_outstanding_exposure_gbp);
      setReason('');
    } catch { setError('Buyer-risk snapshot is unavailable.'); setDetail(null); }
    finally { setLoadingDetail(false); }
  },[]);

  useEffect(()=>{void loadCompanies();},[loadCompanies]);
  useEffect(()=>{if(selectedId)void loadDetail(selectedId);},[selectedId,loadDetail]);

  const filtered = useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return companies;
    return companies.filter((company)=>[company.name,company.company_number,company.email].some((value)=>String(value??'').toLowerCase().includes(q)));
  },[companies,search]);

  const submitReview = async (event:FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const response = await fetch(`/api/super-admin/companies/${selectedId}/buyer-risk`,{
        method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},
        body:JSON.stringify({mode,maxActiveCommitments:maxActive,maxOutstandingExposureGbp:maxExposure,reason}),
      });
      const body = await response.json().catch(()=>({})) as DetailResponse;
      if (!response.ok) { setError(body.error ?? 'Buyer-risk review could not be saved.'); return; }
      setMessage('Transport buyer risk controls updated and audit event recorded.');
      await loadDetail(selectedId);
    } catch { setError('Buyer-risk review could not be saved.'); }
    finally { setSaving(false); }
  };

  const columns:SuperAdminDataColumn<Company>[]=[
    {key:'company',label:'Company',render:(row)=><div><strong>{row.name}</strong><div style={{fontSize:11,color:'#667085'}}>{row.company_number??'No company number'}</div></div>},
    {key:'status',label:'Company status',render:(row)=><StatusChip value={row.status}/>},
    {key:'type',label:'Type',render:(row)=>row.company_type??'standard'},
    {key:'select',label:'Buyer risk',render:(row)=><button type="button" onClick={()=>setSelectedId(row.id)} disabled={loadingDetail&&selectedId===row.id}>{selectedId===row.id?'Selected':'Review'}</button>},
  ];

  const risk=detail?.risk??null;
  return <ProtectedRoute allowedRoles={['owner']}>
    <SuperAdminPage>
      <SuperAdminPageHeader
        eyebrow="Companies · Finance Risk"
        title="Transport Buyer Exposure Controls"
        description="Platform Owner control for new-buyer exposure limits. Drafts remain available; published work and awards are governed by verified active commitments and outstanding transport exposure."
        icon="BR"
        actions={<button type="button" onClick={()=>{void loadCompanies();if(selectedId)void loadDetail(selectedId);}} disabled={loadingList||loadingDetail}>{loadingList||loadingDetail?'Loading…':'Refresh'}</button>}
      />
      {error ? <SuperAdminUnavailableState title="Buyer-risk controls unavailable" description={error}/> : null}
      {message ? <SuperAdminNotice tone="success">{message}</SuperAdminNotice> : null}

      <SuperAdminSectionCard title="Company selection" description="Select a company to inspect its verified transport-buyer exposure snapshot." flush>
        <SuperAdminFilterBar><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search company, number or email…" style={{minHeight:34,minWidth:300}}/></SuperAdminFilterBar>
        {loadingList ? <SuperAdminEmptyState title="Loading company register…"/> : filtered.length===0 ? <SuperAdminEmptyState title="No companies match this view."/> : <SuperAdminDataGrid columns={columns} rows={filtered} rowKey={(row)=>row.id} minWidth={760}/>}
      </SuperAdminSectionCard>

      {risk && detail?.company ? <>
        <SuperAdminMetricGrid>
          <SuperAdminMetricCard label="Effective mode" value={risk.risk_mode} tone={risk.risk_mode==='blocked'?'danger':risk.risk_mode==='restricted'?'warning':'success'}/>
          <SuperAdminMetricCard label="Buyer history" value={risk.is_new_buyer?'New buyer':'Established'} note={`${risk.paid_invoice_count} paid invoice(s)`} tone={risk.is_new_buyer?'warning':'success'}/>
          <SuperAdminMetricCard label="Active commitments" value={risk.active_commitments} note={`Limit ${risk.max_active_commitments}`} tone={risk.active_commitments>=risk.max_active_commitments?'danger':'info'}/>
          <SuperAdminMetricCard label="Outstanding exposure" value={money(risk.outstanding_exposure_gbp)} note={`Limit ${money(risk.max_outstanding_exposure_gbp)}`} tone={risk.outstanding_exposure_gbp>=risk.max_outstanding_exposure_gbp?'danger':'info'}/>
          <SuperAdminMetricCard label="New commitment allowed" value={risk.allowed?'Yes':'No'} note={risk.reason??'Within verified limits'} tone={risk.allowed?'success':'danger'}/>
        </SuperAdminMetricGrid>

        <SuperAdminSectionCard title={`Risk review · ${detail.company.name}`} description="Only Platform Owner can change mode or thresholds. Every mutation requires a reason and is written to the audit ledger.">
          <form onSubmit={submitReview} style={{display:'grid',gap:12,maxWidth:760}}>
            <label style={{display:'grid',gap:5}}><strong>Risk mode</strong><select value={mode} onChange={(event)=>setMode(event.target.value as Risk['risk_mode'])} disabled={saving}><option value="restricted">Restricted</option><option value="cleared">Cleared</option><option value="blocked">Blocked</option></select></label>
            <label style={{display:'grid',gap:5}}><strong>Maximum active commitments</strong><input type="number" min={0} max={10000} value={maxActive} onChange={(event)=>setMaxActive(Number(event.target.value))} disabled={saving}/></label>
            <label style={{display:'grid',gap:5}}><strong>Maximum outstanding exposure (GBP)</strong><input type="number" min={0} step="0.01" value={maxExposure} onChange={(event)=>setMaxExposure(Number(event.target.value))} disabled={saving}/></label>
            <label style={{display:'grid',gap:5}}><strong>Audit reason</strong><textarea value={reason} onChange={(event)=>setReason(event.target.value)} minLength={5} maxLength={2000} required rows={4} placeholder="Explain why this company is being cleared, restricted or blocked…" disabled={saving}/></label>
            <div><button type="submit" disabled={saving||reason.trim().length<5}>{saving?'Saving…':'Save risk review'}</button></div>
          </form>
        </SuperAdminSectionCard>

        <SuperAdminSectionCard title="Risk audit history" description="Newest verified buyer-risk events, including automatic publish/award blocks and Platform Owner reviews.">
          {detail.events?.length ? <div style={{display:'grid',gap:8}}>{detail.events.map((event)=><div key={event.id} style={{border:'1px solid #e4e7ec',borderRadius:8,padding:10,fontSize:12}}><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><strong>{event.event_type}</strong><span>{formatDateTime(event.created_at)}</span>{event.previous_mode||event.new_mode?<span>{event.previous_mode??'—'} → {event.new_mode??'—'}</span>:null}</div><div style={{marginTop:4,color:'#667085'}}>{event.reason??'No reason recorded.'}</div>{event.active_commitments!=null||event.outstanding_exposure_gbp!=null?<div style={{marginTop:4}}>Commitments: {event.active_commitments??'—'} · Exposure: {money(event.outstanding_exposure_gbp)} · Projected: {money(event.projected_exposure_gbp)}</div>:null}</div>)}</div> : <SuperAdminEmptyState title="No buyer-risk events recorded for this company."/>}
        </SuperAdminSectionCard>
      </> : selectedId&&!loadingDetail&&!error ? <SuperAdminUnavailableState title="Risk snapshot unavailable" description="No verified buyer-risk snapshot was returned."/> : null}
    </SuperAdminPage>
  </ProtectedRoute>;
}
