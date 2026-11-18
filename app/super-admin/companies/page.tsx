'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import {
  SuperAdminDataGrid, SuperAdminEmptyState, SuperAdminFilterBar, SuperAdminMetricCard,
  SuperAdminMetricGrid, SuperAdminNotice, SuperAdminPage, SuperAdminPageHeader,
  SuperAdminPager, SuperAdminSectionCard, SuperAdminUnavailableState, type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Company = { id:string; name:string; company_number:string|null; email:string|null; status:string; company_type:string|null; created_at:string };
type AuditRow = { id:string; target_company_id:string; action_type:string; reason?:string; created_at:string };
type ActionType = 'approve'|'reject'|'suspend'|'reinstate';
type Pagination = { page:number; limit:number; total:number; totalPages:number; hasNextPage:boolean; hasPrevPage:boolean };
type ApiResponse = { companies:Company[]; pagination:Pagination; governanceHistoryAvailable?:boolean; governanceHistoryError?:string|null; governanceHistoryByCompany?:Record<string,AuditRow[]>; governanceHistoryRecent?:AuditRow[] };
type CompanySummary = { refreshedAt:string; total:number; active:number; suspended:number; pending:number; rejected:number };
const PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 12_000;
const isPending = (status:string) => ['pending','pending_approval'].includes(status.toLowerCase());
const actionsFor = (status:string):ActionType[] => isPending(status) ? ['approve','reject'] : status.toLowerCase()==='active' ? ['suspend'] : status.toLowerCase()==='suspended' ? ['reinstate'] : [];
const validSummary = (value:unknown): value is CompanySummary => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string,unknown>;
  return typeof row.refreshedAt === 'string' && ['total','active','suspended','pending','rejected'].every((key) => typeof row[key] === 'number' && Number.isFinite(row[key] as number));
};
const validPagination = (value:unknown): value is Pagination => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string,unknown>;
  return ['page','limit','total','totalPages'].every((key) => typeof row[key] === 'number') && typeof row.hasNextPage === 'boolean' && typeof row.hasPrevPage === 'boolean';
};

export default function Page() {
  const [companies,setCompanies] = useState<Company[]>([]);
  const [summary,setSummary] = useState<CompanySummary|null>(null);
  const [pagination,setPagination] = useState<Pagination|null>(null);
  const [page,setPage] = useState(1);
  const [searchInput,setSearchInput] = useState('');
  const [search,setSearch] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [message,setMessage] = useState<string|null>(null);
  const [acting,setActing] = useState<{companyId:string;action:ActionType}|null>(null);
  const [pendingModal,setPendingModal] = useState<{company:Company;action:ActionType}|null>(null);
  const [historyAvailable,setHistoryAvailable] = useState(false);
  const [historyError,setHistoryError] = useState<string|null>(null);
  const [historyByCompany,setHistoryByCompany] = useState<Record<string,AuditRow[]>>({});
  const [historyRecent,setHistoryRecent] = useState<AuditRow[]>([]);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true); setError(null); setCompanies([]); setSummary(null); setPagination(null);
    setHistoryAvailable(false); setHistoryError(null); setHistoryByCompany({}); setHistoryRecent([]);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const auth = await getAuthHeader();
      if (generation !== generationRef.current) return;
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const params = new URLSearchParams({ status:'all', page:String(page), limit:String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const [listRes,summaryRes] = await Promise.all([
        fetch(`/api/super-admin/companies?${params.toString()}`, { headers:{Authorization:auth}, signal:controller.signal, cache:'no-store' }),
        fetch('/api/super-admin/companies/summary', { headers:{Authorization:auth}, signal:controller.signal, cache:'no-store' }),
      ]);
      const [listBody,summaryBody] = await Promise.all([listRes.json().catch(()=>({})), summaryRes.json().catch(()=>({}))]);
      if (generation !== generationRef.current) return;
      if (!listRes.ok || !summaryRes.ok) {
        setError((listBody as {error?:string}).error ?? (summaryBody as {error?:string}).error ?? 'Company governance is unavailable.');
        return;
      }
      const list = listBody as ApiResponse;
      if (!Array.isArray(list.companies) || !validPagination(list.pagination) || !validSummary(summaryBody)) {
        setError('Company governance returned an incomplete snapshot. No totals were inferred.');
        return;
      }
      setCompanies(list.companies); setPagination(list.pagination); setSummary(summaryBody);
      setHistoryAvailable(Boolean(list.governanceHistoryAvailable));
      setHistoryError(list.governanceHistoryError ?? null);
      setHistoryByCompany(list.governanceHistoryByCompany ?? {});
      setHistoryRecent(list.governanceHistoryRecent ?? []);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'AbortError'
        ? 'Company governance timed out. No stale data is being shown.'
        : 'Company governance service is currently unavailable.');
    } finally {
      window.clearTimeout(timeout);
      if (generation === generationRef.current) setLoading(false);
    }
  }, [page,search]);
  useEffect(() => { void load(); return () => { generationRef.current += 1; }; }, [load]);

  const handleAction = async (companyId:string, action:ActionType, reason='') => {
    setActing({companyId,action}); setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setMessage('No active Platform Owner session.'); return; }
      const response = await fetch(`/api/super-admin/companies/${companyId}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:auth},
        body:JSON.stringify({action,...(reason?{reason}:{})}),
      });
      const body = await response.json().catch(()=>({}));
      if (!response.ok) setMessage((body as {error?:string}).error ?? 'The requested company action could not be completed.');
      else { setMessage(`Action '${action}' applied successfully.`); await load(); }
    } catch {
      setMessage('The requested company action could not be completed.');
    } finally { setActing(null); }
  };

  const initiateAction = (company:Company, action:ActionType) => {
    if (action === 'suspend' || action === 'reject') setPendingModal({company,action});
    else void handleAction(company.id,action);
  };
  const applySearch = (event:FormEvent) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); };
  const columns: SuperAdminDataColumn<Company>[] = [
    { key:'company', label:'Company', render:(row)=><div><strong>{row.name}</strong><div style={{fontSize:11,color:'#667085'}}>Reg: {row.company_number ?? '—'}</div></div> },
    { key:'status', label:'Status', render:(row)=><StatusChip value={row.status}/> },
    { key:'type', label:'Type', render:(row)=>row.company_type ?? 'standard' },
    { key:'email', label:'Email', render:(row)=>row.email ?? '—' },
    { key:'created', label:'Created', render:(row)=>formatDateTime(row.created_at) },
    { key:'actions', label:'Governance', render:(row)=>{
      const actions = actionsFor(row.status);
      return <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{actions.length===0 ? <span style={{color:'#667085'}}>No action</span> : actions.map((action)=><button key={action} type="button" disabled={Boolean(acting)} onClick={()=>initiateAction(row,action)} style={{minHeight:30,padding:'0 9px'}}>{acting?.companyId===row.id&&acting.action===action?'…':action}</button>)}</div>;
    }},
    { key:'history', label:'Audit history', render:(row)=>{
      const entries = historyByCompany[row.id] ?? [];
      if (!historyAvailable) return <span style={{color:'#667085'}}>Unavailable</span>;
      if (entries.length===0) return <span style={{color:'#667085'}}>No entries</span>;
      return <div>{entries.slice(0,3).map((entry)=><div key={entry.id} style={{fontSize:11}}><strong>{entry.action_type}</strong> · {formatDateTime(entry.created_at)}</div>)}</div>;
    }},
    { key:'inspect', label:'Inspect', render:(row)=><PlatformEntityLink entityType="company" entityId={row.id} compact>Inspect</PlatformEntityLink> },
  ];

  return <ProtectedRoute allowedRoles={['owner']}>
    <ActionConfirmModal
      open={pendingModal!==null}
      title={pendingModal?.action==='suspend'?'Suspend company':'Reject company'}
      description={pendingModal ? <>Confirm <strong>{pendingModal.action}</strong> for <strong>{pendingModal.company.name}</strong>. This governance mutation is audit controlled.</> : ''}
      confirmLabel={pendingModal?.action==='suspend'?'Confirm suspension':'Confirm rejection'}
      danger reasonRequired reasonPlaceholder="Record the governance reason…"
      submitting={acting!==null}
      onCancel={()=>setPendingModal(null)}
      onConfirm={(reason)=>{if(!pendingModal)return;const next=pendingModal;setPendingModal(null);void handleAction(next.company.id,next.action,reason);}}
    />
    <SuperAdminPage>
      <SuperAdminPageHeader
        eyebrow="Companies"
        title="All Companies Governance"
        description="Platform-wide company register with exact global status counts, auditable governance actions and canonical entity drill-down."
        icon="CO"
        meta={summary ? <>Verified {new Date(summary.refreshedAt).toLocaleString('en-GB')}</> : undefined}
        actions={<button type="button" onClick={()=>void load()} disabled={loading}>{loading?'Loading…':'Refresh'}</button>}
      />
      {error ? <SuperAdminUnavailableState title="Company governance unavailable" description={error}/> : null}
      {!error ? <>
        <SuperAdminMetricGrid>
          <SuperAdminMetricCard label="Total" value={loading?'—':summary?.total??'Unavailable'} tone="info"/>
          <SuperAdminMetricCard label="Active" value={loading?'—':summary?.active??'Unavailable'} tone="success"/>
          <SuperAdminMetricCard label="Pending" value={loading?'—':summary?.pending??'Unavailable'} tone="warning"/>
          <SuperAdminMetricCard label="Suspended" value={loading?'—':summary?.suspended??'Unavailable'} tone="danger"/>
          <SuperAdminMetricCard label="Rejected" value={loading?'—':summary?.rejected??'Unavailable'} tone="neutral"/>
        </SuperAdminMetricGrid>
        <SuperAdminFilterBar>
          <form onSubmit={applySearch} style={{display:'flex',gap:8,flexWrap:'wrap',width:'100%'}}>
            <input value={searchInput} onChange={(event)=>setSearchInput(event.target.value)} placeholder="Search name, company number or email…" style={{minHeight:34,minWidth:280,flex:'0 1 420px'}}/>
            <button type="submit" disabled={loading}>Search</button>
            {search ? <button type="button" onClick={()=>{setSearchInput('');setSearch('');setPage(1);}}>Clear</button> : null}
          </form>
        </SuperAdminFilterBar>
        {message ? <SuperAdminNotice tone="warning">{message}</SuperAdminNotice> : null}
        {!historyAvailable && !loading ? <SuperAdminNotice tone="unavailable">Governance audit history is unavailable.{historyError ? ' Diagnostics remain server-side.' : ''}</SuperAdminNotice> : null}
        <SuperAdminSectionCard title="Company register" description="Searchable, server-paginated and linked to Platform Entity Inspector." flush>
          {loading ? <SuperAdminEmptyState title="Loading verified company page…"/> : companies.length===0 ? <SuperAdminEmptyState title="No companies match this view."/> : <SuperAdminDataGrid columns={columns} rows={companies} rowKey={(row)=>row.id} minWidth={1180}/>}
          {pagination ? <SuperAdminPager page={pagination.page} totalCount={pagination.total} canPrev={pagination.hasPrevPage&&!loading} canNext={pagination.hasNextPage&&!loading} onPrev={()=>setPage((value)=>Math.max(1,value-1))} onNext={()=>setPage((value)=>value+1)}/> : null}
        </SuperAdminSectionCard>
        <SuperAdminSectionCard title="Recent Governance Events" description="Newest audited company governance actions returned by the canonical company service.">
          {!historyAvailable ? <SuperAdminUnavailableState title="Governance history unavailable" description="No audit events are inferred while the source is unavailable."/> : historyRecent.length===0 ? <SuperAdminEmptyState title="No governance events recorded."/> : <div style={{display:'grid',gap:8}}>{historyRecent.slice(0,12).map((event)=><div key={event.id} style={{fontSize:12}}><strong>{event.action_type}</strong> · {formatDateTime(event.created_at)}{event.reason ? ` · ${event.reason}` : ''}</div>)}</div>}
        </SuperAdminSectionCard>
      </> : null}
    </SuperAdminPage>
  </ProtectedRoute>;
}
