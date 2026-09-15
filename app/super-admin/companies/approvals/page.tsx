'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import {
  SuperAdminDataGrid, SuperAdminEmptyState, SuperAdminMetricCard, SuperAdminMetricGrid,
  SuperAdminNotice, SuperAdminPage, SuperAdminPageHeader, SuperAdminSectionCard,
  SuperAdminStatusBadge, SuperAdminUnavailableState, type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Company = { id:string; name:string; company_number:string|null; email:string|null; status:string; company_type:string|null; created_at:string };
type Readiness = {
  companyId:string; registrationProvided:boolean; emailProvided:boolean; driverCount:number; vehicleCount:number;
  documentCount:number; approvedDocuments:number; pendingDocuments:number; rejectedDocuments:number;
  expiredDocuments:number; readinessScore:number; readiness:'ready'|'review'|'blocked';
};
type Pending = { company:Company; action:'approve'|'reject'; readiness?:Readiness } | null;
const toneFor = (value:Readiness['readiness']) => value==='ready'?'success':value==='blocked'?'danger':'warning';
export default function Page() {
  const [companies,setCompanies] = useState<Company[]>([]);
  const [readinessByCompany,setReadinessByCompany] = useState<Record<string,Readiness>>({});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [pending,setPending] = useState<Pending>(null);
  const [submitting,setSubmitting] = useState(false);
  const [message,setMessage] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const [companiesResponse,readinessResponse] = await Promise.all([
        fetch('/api/super-admin/companies?status=pending&limit=100',{headers:{Authorization:auth},cache:'no-store'}),
        fetch('/api/super-admin/companies/approval-readiness',{headers:{Authorization:auth},cache:'no-store'}),
      ]);
      const companiesBody = await companiesResponse.json().catch(()=>({}));
      if (!companiesResponse.ok) { setError((companiesBody as {error?:string}).error ?? 'Approvals queue is unavailable.'); return; }
      const rows = (companiesBody as {companies?:Company[]}).companies;
      if (!Array.isArray(rows)) { setError('Approvals queue returned an incomplete company snapshot.'); return; }
      setCompanies(rows);
      const readinessBody = await readinessResponse.json().catch(()=>({}));
      if (readinessResponse.ok) setReadinessByCompany((readinessBody as {readiness?:Record<string,Readiness>}).readiness ?? {});
      else setReadinessByCompany({});
    } catch {
      setError('Approvals queue is unavailable.');
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{void load();},[load]);

  const summary = useMemo(() => {
    const known = companies.map((company)=>readinessByCompany[company.id]).filter((row):row is Readiness=>Boolean(row));
    return {
      pending:companies.length,
      ready:known.filter((row)=>row.readiness==='ready').length,
      review:known.filter((row)=>row.readiness==='review').length,
      blocked:known.filter((row)=>row.readiness==='blocked').length,
      unavailable:companies.length-known.length,
    };
  },[companies,readinessByCompany]);

  const confirm = async (reason:string) => {
    if (!pending) return;
    const current = pending;
    setSubmitting(true); setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setMessage('No active Platform Owner session.'); return; }
      const response = await fetch(`/api/super-admin/companies/${current.company.id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:auth},
        body:JSON.stringify({action:current.action,...(reason?{reason}:{})}),
      });
      const body = await response.json().catch(()=>({}));
      if (!response.ok) setMessage((body as {error?:string}).error ?? `Company ${current.action} failed.`);
      else { setMessage(`Company ${current.action==='approve'?'approved':'rejected'} successfully.`); await load(); }
    } catch {
      setMessage(`Company ${current.action} failed.`);
    } finally {
      setPending(null); setSubmitting(false);
    }
  };

  const columns: SuperAdminDataColumn<Company>[] = [
    { key:'company', label:'Company', render:(row)=><div><PlatformEntityLink entityType="company" entityId={row.id} compact>{row.name}</PlatformEntityLink><div style={{fontSize:11,color:'#667085'}}>{row.email ?? 'No email'}</div></div> },
    { key:'registration', label:'Registration', render:(row)=>row.company_number ?? <SuperAdminStatusBadge label="Missing" tone="warning"/> },
    { key:'type', label:'Type', render:(row)=>(row.company_type ?? 'standard').replaceAll('_',' ') },
    { key:'resources', label:'Resources', render:(row)=>{const readiness=readinessByCompany[row.id];return readiness ? `${readiness.driverCount} drivers · ${readiness.vehicleCount} vehicles` : 'Unavailable';} },
    { key:'readiness', label:'Compliance readiness', render:(row)=>{const readiness=readinessByCompany[row.id];return readiness ? <div><SuperAdminStatusBadge label={`${readiness.readinessScore}/100 · ${readiness.readiness}`} tone={toneFor(readiness.readiness)}/><div style={{fontSize:11,color:'#667085',marginTop:4}}>{readiness.approvedDocuments}/{readiness.documentCount} docs approved{readiness.expiredDocuments?` · ${readiness.expiredDocuments} expired`:''}{readiness.rejectedDocuments?` · ${readiness.rejectedDocuments} rejected`:''}</div></div> : <SuperAdminStatusBadge label="Unavailable" tone="unavailable"/>;} },
    { key:'applied', label:'Applied', render:(row)=>formatDateTime(row.created_at) },
    { key:'actions', label:'Actions', render:(row)=><div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" onClick={()=>{setMessage(null);setPending({company:row,action:'approve',readiness:readinessByCompany[row.id]});}} disabled={submitting}>Approve</button><button type="button" onClick={()=>{setMessage(null);setPending({company:row,action:'reject',readiness:readinessByCompany[row.id]});}} disabled={submitting}>Reject</button></div> },
  ];

  const pendingReadiness = pending?.readiness;
  const pendingDescription = pending ? <>
    {pending.action==='approve' ? 'Approve' : 'Reject'} <strong>{pending.company.name}</strong>.
    {pendingReadiness ? <> Readiness: <strong>{pendingReadiness.readinessScore}/100 · {pendingReadiness.readiness}</strong>, with {pendingReadiness.approvedDocuments}/{pendingReadiness.documentCount} documents approved.</> : <> Readiness evidence is unavailable; no approval state is inferred from missing data.</>}
    {pending.action==='approve' && pendingReadiness?.readiness==='blocked' ? <> This is a deliberate Platform Owner override of a blocked readiness state and remains audit recorded.</> : null}
  </> : '';

  return <ProtectedRoute allowedRoles={['owner']}>
    <ActionConfirmModal
      open={pending!==null} title={pending?.action==='approve'?'Approve company':'Reject company'}
      description={pendingDescription} confirmLabel={pending?.action==='approve'?'Confirm approval':'Confirm rejection'}
      danger={pending?.action!=='approve'} reasonRequired={pending?.action==='reject'}
      reasonLabel={pending?.action==='reject'?'Reason for rejection':'Reason / notes'}
      reasonPlaceholder={pending?.action==='reject'?'Explain why this application is being rejected…':'Optional approval notes…'}
      submitting={submitting} onCancel={()=>setPending(null)} onConfirm={(reason)=>void confirm(reason)}
    />
    <SuperAdminPage>
      <SuperAdminPageHeader eyebrow="Companies" title="Approvals Queue" description="Review company identity and available compliance evidence before granting platform access." icon="AP" actions={<button type="button" onClick={()=>void load()} disabled={loading}>{loading?'Loading…':'Refresh'}</button>}/>
      <SuperAdminMetricGrid>
        <SuperAdminMetricCard label="Pending" value={loading?'—':summary.pending} tone="info"/>
        <SuperAdminMetricCard label="Ready" value={loading?'—':summary.ready} tone="success"/>
        <SuperAdminMetricCard label="Needs Review" value={loading?'—':summary.review} tone="warning"/>
        <SuperAdminMetricCard label="Blocked" value={loading?'—':summary.blocked} tone="danger"/>
        <SuperAdminMetricCard label="Readiness Unavailable" value={loading?'—':summary.unavailable} tone="unavailable"/>
      </SuperAdminMetricGrid>
      <SuperAdminNotice tone="info">Readiness uses only evidence present in the connected schema. It does not claim Companies House, VAT or identity verification unless a verified source exists.</SuperAdminNotice>
      {message ? <SuperAdminNotice tone="warning">{message}</SuperAdminNotice> : null}
      {error ? <SuperAdminUnavailableState title="Approvals queue unavailable" description={error}/> : <SuperAdminSectionCard title="Pending company approvals" description="Approval and rejection are deliberate Platform Owner mutations and remain audit controlled." flush>
        {loading ? <SuperAdminEmptyState title="Loading approval evidence…"/> : companies.length===0 ? <SuperAdminEmptyState title="No companies pending approval."/> : <SuperAdminDataGrid columns={columns} rows={companies} rowKey={(row)=>row.id} minWidth={1180}/>}
      </SuperAdminSectionCard>}
    </SuperAdminPage>
  </ProtectedRoute>;
}
