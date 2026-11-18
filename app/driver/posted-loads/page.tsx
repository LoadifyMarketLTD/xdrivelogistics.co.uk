'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../components/AuthContext';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { isSupabaseConfigured } from '../../../lib/supabaseClient';
import { readRouteAuthHeader } from '../../../lib/routeAuthCookie';
import { resolveWorkspaceRole } from '../../../lib/workspaceRole';

type PostedLoad = {
  id: string;
  company_id: string;
  created_by: string;
  status: string | null;
  current_status: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  created_at: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  customer_reference: string | null;
};
type StatusFilter = 'all' | 'draft' | 'other';
const ref = (id: string) => 'XDL-' + id.slice(0, 8).toUpperCase();
const niceDate = (raw: string | null) => raw && Number.isFinite(new Date(raw).getTime())
  ? new Date(raw).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not scheduled';
const controlStyle = { padding: '7px 12px', minHeight: 34, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0a234f', fontWeight: 700, cursor: 'pointer' } as const;

export default function OwnerPostedLoadsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const ownerDriver = resolveWorkspaceRole(user) === 'owner_driver';
  const [rows, setRows] = useState<PostedLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const newJobId = params.get('created');

  const loadJobs = useCallback(async () => {
    if (!ownerDriver || !user?.id || !isSupabaseConfigured) {
      setRows([]);
      setError('Approved Owner Driver login required.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const companyId = await resolveActiveCompanyId({ userId: user.id, fallbackCompanyId: user.companyId ?? null });
      if (!companyId) throw Error('Your active company could not be verified.');
      // The API independently verifies the bearer principal, driver type, active company
      // owner membership and exact company/creator scope before using a privileged read.
      const authorization = await readRouteAuthHeader();
      if (!authorization) throw Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/driver/posted-loads', {
        headers: { Authorization: authorization },
        cache: 'no-store',
      });
      const result = (await response.json().catch(() => null)) as { jobs?: PostedLoad[]; error?: string } | null;
      if (!response.ok) throw Error(result?.error ?? 'Saved company loads are temporarily unavailable.');
      setRows((result?.jobs ?? []).filter(job => job.company_id === companyId && job.created_by === user.id));
    } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : 'Could not load your saved work.');
    } finally {
      setLoading(false);
    }
  }, [ownerDriver, user?.id, user?.companyId]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);
  const drafts = rows.filter(job => job.status?.toLowerCase() === 'draft').length;
  const listed = useMemo(() => rows.filter(job => {
    const draft = job.status?.toLowerCase() === 'draft';
    if ((filter === 'draft' && !draft) || (filter === 'other' && draft)) return false;
    const term = search.trim().toLowerCase();
    return !term || [ref(job.id), job.id, job.customer_reference, job.pickup_location,
      job.delivery_location, job.status, job.vehicle_type].some(s => String(s ?? '').toLowerCase().includes(term));
  }), [rows, filter, search]);
  const newlySaved = newJobId && rows.find(job => job.id === newJobId);
  return <ProtectedRoute allowedRoles={['driver']}>
    <DriverWorkspaceShell hideHeader>
      <main style={{ padding: '18px 20px', color: '#1f2937', width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 23, fontWeight: 800, margin: '0 0 5px' }}>My Posted Loads &amp; Drafts</h1>
            <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>Loads created by this Owner Driver account. Private drafts are never shown in Marketplace searches.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" style={controlStyle} disabled={loading} onClick={() => void loadJobs()}>Refresh</button>
            <button type="button" style={controlStyle} onClick={() => router.push('/driver/loads')}>Find Marketplace Loads</button>
            <button type="button" style={{ ...controlStyle, color: '#fff', borderColor: '#0e3fa9', background: '#0e3fa9' }} onClick={() => router.push('/driver/post-load')}>New Post Load</button>
          </div>
        </header>
        {newJobId ? <p role="status" style={{ padding: 10, background: '#eff6ff', borderRadius: 6, color: '#1e40af' }}>
          {loading ? 'Checking your newly saved load…' : newlySaved
            ? (newlySaved.status === 'draft' ? 'Private draft saved: ' : 'Load saved: ') + ref(newlySaved.id)
            : error ? 'Could not verify the saved load.' : 'Saved load not found in your company view. Refresh to check again.'}
        </p> : null}
        <div role="group" aria-label="My posted load statuses" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 14 }}>
          {([['all','All (' + rows.length + ')'],['draft','Drafts (' + drafts + ')'],['other','Other statuses (' + (rows.length-drafts) + ')']] as const).map(([value,label]) =>
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}
              style={{ ...controlStyle, background: filter === value ? '#0a234f' : '#fff', color: filter === value ? '#fff' : '#0a234f' }}>{label}</button>)}
          <input type="search" aria-label="Search my posted loads" placeholder="Job ref, customer ref, route..." value={search}
            onChange={event => setSearch(event.target.value)} style={{ minHeight: 34, padding: '6px 9px', minWidth: 160, flex: '1 1 200px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
        </div>
        {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> :
          loading ? <p role="status">Loading saved company loads…</p> :
          listed.length === 0 ? <p role="status" style={{ padding: 18, border: '1px solid #e5e7eb', borderRadius: 8 }}>{rows.length ? 'No matching loads.' : 'No posted loads or saved drafts yet.'}</p> :
          <div style={{ display: 'grid', gap: 9 }}>
            {listed.map(job => {
              const draft = job.status?.toLowerCase() === 'draft';
              return <article key={job.id} data-job-id={job.id} data-job-status={job.status ?? ''} style={{ padding: 14, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong style={{ color: '#0a234f' }}>{ref(job.id)}</strong>
                  <span style={{ padding: '3px 8px', borderRadius: 5, background: draft ? '#e5e7eb' : '#dbeafe', color: draft ? '#374151' : '#1e40af', fontSize: 12, fontWeight: 700 }}>
                    {draft ? 'Private Draft — not published' : (job.current_status || job.status || 'Unknown status').replace(/_/g, ' ')}
                  </span>
                </div>
                <p style={{ margin: '8px 0', fontWeight: 700 }}>{job.pickup_location || 'Collection not supplied'} → {job.delivery_location || 'Delivery not supplied'}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#475569' }}>
                  <span>Collection: {niceDate(job.pickup_datetime)}</span><span>Delivery: {niceDate(job.delivery_datetime)}</span>
                  <span>Vehicle: {job.vehicle_type || 'Not supplied'}</span><span>Cargo: {job.cargo_type || 'Not supplied'}</span>
                  {job.customer_reference ? <span>Customer ref: {job.customer_reference}</span> : null}
                </div>
                {draft ? <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 12 }}>Saved privately. No transport invitation or invoice was sent by this page.</p> : null}
              </article>;
            })}
          </div>}
        {!loading && rows.length >= 200 ? <p role="status">Showing the latest 200 records only.</p> : null}
      </main>
    </DriverWorkspaceShell>
  </ProtectedRoute>;
}
