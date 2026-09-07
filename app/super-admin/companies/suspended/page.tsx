'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import { ActionConfirmModal } from '@/app/super-admin/_components/ActionConfirmModal';
import PlatformEntityLink from '@/app/super-admin/_components/control-plane/PlatformEntityLink';
import { StatusChip, formatDateTime } from '@/app/super-admin/_components/superAdminFormatters';
import {
  SuperAdminDataGrid, SuperAdminEmptyState, SuperAdminNotice, SuperAdminPage,
  SuperAdminPageHeader, SuperAdminSectionCard, SuperAdminUnavailableState, type SuperAdminDataColumn,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Company = { id:string; name:string; company_number:string|null; email:string|null; status:string; company_type:string|null; created_at:string };
type Pending = { companyId:string; companyName:string } | null;

export default function Page() {
  const [companies,setCompanies] = useState<Company[]>([]);
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
      const response = await fetch('/api/super-admin/companies?status=suspended&limit=100', { headers:{Authorization:auth}, cache:'no-store' });
      const body = await response.json().catch(()=>({}));
      if (!response.ok) { setError((body as {error?:string}).error ?? 'Suspended company service is unavailable.'); return; }
      const rows = (body as {companies?:Company[]}).companies;
      if (!Array.isArray(rows)) { setError('Suspended company service returned an incomplete snapshot.'); return; }
      setCompanies(rows);
    } catch {
      setError('Suspended company service is unavailable.');
    } finally { setLoading(false); }
  },[]);

  useEffect(()=>{void load();},[load]);

  const reinstate = async (reason:string) => {
    if (!pending) return;
    setSubmitting(true); setMessage(null);
    try {
      const auth = await getAuthHeader();
      if (!auth) { setMessage('No active Platform Owner session.'); return; }
      const response = await fetch(`/api/super-admin/companies/${pending.companyId}`, {
        method:'PATCH', headers:{'Content-Type':'application/json',Authorization:auth},
        body:JSON.stringify({action:'reinstate',...(reason?{reason}:{})}),
      });
      const body = await response.json().catch(()=>({}));
      if (!response.ok) setMessage((body as {error?:string}).error ?? 'The company could not be reinstated.');
      else { setMessage('Company reinstated successfully.'); await load(); }
    } catch {
      setMessage('The company could not be reinstated.');
    } finally {
      setPending(null); setSubmitting(false);
    }
  };

  const columns: SuperAdminDataColumn<Company>[] = [
    { key:'company', label:'Company', render:(row)=><PlatformEntityLink entityType="company" entityId={row.id} compact>{row.name}</PlatformEntityLink> },
    { key:'registration', label:'Registration', render:(row)=>row.company_number ?? '—' },
    { key:'email', label:'Email', render:(row)=>row.email ?? '—' },
    { key:'type', label:'Type', render:(row)=>(row.company_type ?? 'standard').replaceAll('_',' ') },
    { key:'status', label:'Status', render:(row)=><StatusChip value={row.status}/> },
    { key:'created', label:'Created', render:(row)=>formatDateTime(row.created_at) },
    { key:'action', label:'Governance', render:(row)=><button type="button" onClick={()=>{setMessage(null);setPending({companyId:row.id,companyName:row.name});}} disabled={submitting}>Reinstate</button> },
  ];
  return <ProtectedRoute allowedRoles={['owner']}>
    <ActionConfirmModal
      open={pending!==null} title="Reinstate company"
      description={pending ? <>Restore platform access for <strong>{pending.companyName}</strong>. Existing company data is preserved and the action remains audit controlled.</> : ''}
      confirmLabel="Confirm reinstatement" danger={false} reasonRequired={false}
      reasonLabel="Reason / notes" reasonPlaceholder="Optional reason for reinstatement…"
      submitting={submitting} onCancel={()=>setPending(null)} onConfirm={(reason)=>void reinstate(reason)}
    />
    <SuperAdminPage>
      <SuperAdminPageHeader eyebrow="Companies" title="Suspended Companies" description="Suspended platform companies with canonical entity inspection and governed reinstatement." icon="SC" actions={<button type="button" onClick={()=>void load()} disabled={loading}>{loading?'Loading…':'Refresh'}</button>}/>
      {message ? <SuperAdminNotice tone="warning">{message}</SuperAdminNotice> : null}
      {error ? <SuperAdminUnavailableState title="Suspended companies unavailable" description={error}/> : <SuperAdminSectionCard title="Suspended register" description="Reinstatement restores access; it does not delete or recreate the company." flush>
        {loading ? <SuperAdminEmptyState title="Loading suspended companies…"/> : companies.length===0 ? <SuperAdminEmptyState title="No suspended companies."/> : <SuperAdminDataGrid columns={columns} rows={companies} rowKey={(row)=>row.id} minWidth={980}/>}
      </SuperAdminSectionCard>}
    </SuperAdminPage>
  </ProtectedRoute>;
}
