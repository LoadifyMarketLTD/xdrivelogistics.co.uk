'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { getAuthHeader } from '@/app/super-admin/_lib/getAuthHeader';
import {
  SuperAdminMetricCard, SuperAdminMetricGrid, SuperAdminPage, SuperAdminPageHeader,
  SuperAdminSectionCard, SuperAdminUnavailableState,
} from '@/app/super-admin/_components/SuperAdminEnterprisePrimitives';

type Summary = {
  total:number; approved:number; pending:number; rejected:number; expired:number;
  expiring_soon:number; expiry_warning_days:number;
};
type Payload = { rows:unknown[]; summary:Summary };
const REQUEST_TIMEOUT_MS = 12_000;
const validPayload = (value:unknown): value is Payload => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string,unknown>;
  const summary = row.summary as Record<string,unknown>|undefined;
  return Array.isArray(row.rows) && Boolean(summary) && ['total','approved','pending','rejected','expired','expiring_soon','expiry_warning_days'].every((key)=>typeof summary?.[key]==='number');
};
export default function Page() {
  const [summary,setSummary] = useState<Summary|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true); setError(null); setSummary(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try {
      const auth = await getAuthHeader();
      if (generation !== generationRef.current) return;
      if (!auth) { setError('No active Platform Owner session.'); return; }
      const response = await fetch('/api/super-admin/compliance/documents?limit=500', {
        headers:{Authorization:auth}, signal:controller.signal, cache:'no-store',
      });
      const body = await response.json().catch(()=>({}));
      if (generation !== generationRef.current) return;
      if (!response.ok) { setError((body as {error?:string}).error ?? `Compliance overview unavailable (${response.status}).`); return; }
      if (!validPayload(body)) { setError('Compliance review returned an incomplete snapshot. No counts were inferred.'); return; }
      setSummary(body.summary);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name==='AbortError'
        ? 'Compliance overview timed out. No stale values are being shown.'
        : 'Compliance overview could not be loaded.');
    } finally {
      window.clearTimeout(timeout);
      if (generation===generationRef.current) setLoading(false);
    }
  },[]);

  useEffect(()=>{void load();return()=>{generationRef.current+=1;};},[load]);
  const destinations = [
    ['/super-admin/compliance/documents','Document Review','Review company, identity, driver and vehicle evidence.'],
    ['/super-admin/compliance/expiries','Expiry Tracking','Prioritise expired and upcoming document expiries.'],
    ['/super-admin/compliance/insurance','Insurance','Inspect insurance evidence across drivers and vehicles.'],
    ['/super-admin/compliance/operator-licences','Operator Licences','Inspect operator-licence evidence available in the platform.'],
    ['/super-admin/compliance/fraud-cases','Identity & Fraud Review','Review canonical identity/fraud cases without inferring verification.'],
  ] as const;

  return <ProtectedRoute allowedRoles={['owner']}><SuperAdminPage>
    <SuperAdminPageHeader eyebrow="Compliance" title="Compliance Overview" description="Platform Owner compliance control surface for document review, expiry risk, insurance, operator licences and identity/fraud review." icon="CP" actions={<button type="button" onClick={()=>void load()} disabled={loading}>{loading?'Loading…':'Refresh'}</button>}/>
    {error ? <SuperAdminUnavailableState title="Compliance overview unavailable" description={error}/> : <>
      <SuperAdminMetricGrid>
        <SuperAdminMetricCard label="Loaded Records" value={loading?'—':summary?.total??'Unavailable'} note="Newest review snapshot; not presented as an exact platform-wide total." tone="info"/>
        <SuperAdminMetricCard label="Approved / Verified" value={loading?'—':summary?.approved??'Unavailable'} tone="success"/>
        <SuperAdminMetricCard label="Pending Review" value={loading?'—':summary?.pending??'Unavailable'} tone="warning"/>
        <SuperAdminMetricCard label="Rejected" value={loading?'—':summary?.rejected??'Unavailable'} tone="danger"/>
        <SuperAdminMetricCard label="Expired" value={loading?'—':summary?.expired??'Unavailable'} tone="danger"/>
        <SuperAdminMetricCard label="Expiring Soon" value={loading?'—':summary?.expiring_soon??'Unavailable'} note={summary?`Within configured ${summary.expiry_warning_days}-day window`:undefined} tone="warning"/>
      </SuperAdminMetricGrid>
      <SuperAdminSectionCard title="Compliance workspaces" description="Every destination keeps its existing owner-only authorization and audited mutations.">
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          {destinations.map(([href,title,description])=><Link key={href} href={href} data-card="enterprise" style={{border:'1px solid #E5E7EB',borderRadius:8,padding:14,textDecoration:'none',color:'#0B2F6B',background:'#FFFFFF'}}><strong>{title}</strong><p style={{margin:'6px 0 0',fontSize:12,color:'#667085',lineHeight:1.45}}>{description}</p></Link>)}
        </div>
      </SuperAdminSectionCard>
      <SuperAdminSectionCard title="Truth boundary" description="Compliance data is evidence-driven and fail-closed.">
        <p style={{margin:0,fontSize:12,lineHeight:1.55,color:'#667085'}}>This overview reports only the document evidence returned by the canonical compliance review source. Missing source data is not converted into approval, regulator readiness, or a zero-risk state. Document view and review actions remain audit logged.</p>
      </SuperAdminSectionCard>
    </>}
  </SuperAdminPage></ProtectedRoute>;
}
