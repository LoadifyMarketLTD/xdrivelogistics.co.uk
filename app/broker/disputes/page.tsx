'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import { ActionButton, AlertBanner, DataTable, EmptyState, PageFrame, PageHeader, StatusBadge } from '../../components/workspace/WorkspaceUI';

type BrokerDispute = {
  id: string;
  job_id: string;
  raised_by_company_id: string;
  status: string;
  description: string | null;
  resolution_note: string | null;
  created_at: string;
};

const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function BrokerDisputesPage() {
  const data = useCompanyWorkspaceData();
  const [rows, setRows] = useState<BrokerDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'all' | 'open' | 'investigating' | 'resolved'>('all');
  const [reference, setReference] = useState('');

  const getAuthHeader = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const load = useCallback(async () => {
    if (!data.companyId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setError('');
    const jobIds = data.jobs.map((job) => job.id);
    let query = supabase
      .from('job_disputes')
      .select('id, job_id, raised_by_company_id, status, description, resolution_note, created_at')
      .order('created_at', { ascending: false })
      .limit(250);
    query = jobIds.length > 0
      ? query.or(`raised_by_company_id.eq.${data.companyId},job_id.in.(${jobIds.join(',')})`)
      : query.eq('raised_by_company_id', data.companyId);
    const { data: result, error: queryError } = await query;
    if (queryError) { setError(queryError.message); setRows([]); }
    else setRows((result ?? []) as BrokerDispute[]);
    setLoading(false);
  }, [data.companyId, data.jobs]);

  useEffect(() => { void load(); }, [load]);

  const visibleRows = useMemo(() => {
    const needle = reference.trim().toLowerCase();
    return rows.filter((row) => {
      const rowStatus = String(row.status ?? '').toLowerCase();
      if (status === 'open' && rowStatus !== 'open') return false;
      if (status === 'investigating' && rowStatus !== 'investigating') return false;
      if (status === 'resolved' && !['resolved', 'closed'].includes(rowStatus)) return false;
      return !needle || row.job_id.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle);
    });
  }, [reference, rows, status]);

  const counts = useMemo(() => ({
    all: rows.length,
    open: rows.filter((row) => row.status === 'open').length,
    investigating: rows.filter((row) => row.status === 'investigating').length,
    resolved: rows.filter((row) => ['resolved', 'closed'].includes(row.status)).length,
  }), [rows]);

  const runAction = async (disputeId: string, action: 'resolve' | 'escalate') => {
    setWorking(disputeId); setNotice(''); setError('');
    const auth = await getAuthHeader();
    if (!auth) { setError('Session expired. Please sign in again.'); setWorking(null); return; }
    const response = await fetch(`/api/broker/disputes/${disputeId}`, {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, resolution_note: notes[disputeId]?.trim() || undefined }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setWorking(null);
    if (!response.ok) { setError(payload.error ?? 'Action failed.'); return; }
    setNotice(action === 'resolve' ? 'Dispute resolved.' : 'Dispute escalated to investigating.');
    setNotes((current) => { const next = { ...current }; delete next[disputeId]; return next; });
    await load();
  };

  return (
    <PageFrame>
      <PageHeader eyebrow="Commercial exceptions" title="Disputes" description="Customer, carrier and POD disputes linked only to broker-managed loads." actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>} />
      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Dispute filters">
          <div className="workspace-filter-rail__header">Search Disputes</div>
          <div className="workspace-filter-rail__body">
            <label>JOB / DISPUTE ID<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference" /></label>
            <label>STATUS<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All ({counts.all})</option><option value="open">Open ({counts.open})</option><option value="investigating">Investigating ({counts.investigating})</option><option value="resolved">Resolved ({counts.resolved})</option></select></label>
            <ActionButton tone="secondary" onClick={() => { setReference(''); setStatus('all'); }}>Clear</ActionButton>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta"><span><strong>{visibleRows.length}</strong> dispute{visibleRows.length === 1 ? '' : 's'}</span><span>Open {counts.open} · Investigating {counts.investigating} · Resolved {counts.resolved}</span></div>
          <div className="workspace-panel">
            <DataTable
              columns={['Job', 'Raised by', 'Issue', 'Opened', 'Status', 'Resolution note', 'Actions']}
              rows={visibleRows.map((row) => {
                const isActive = !['resolved', 'closed'].includes(row.status);
                return [
                  row.job_id.slice(0, 8).toUpperCase(),
                  row.raised_by_company_id === data.companyId ? 'Broker company' : 'Trading partner',
                  row.description ?? 'No description recorded',
                  when(row.created_at),
                  <StatusBadge key="status" value={row.status} />,
                  row.resolution_note ?? 'Pending',
                  isActive ? (
                    <div key="actions" style={{ display: 'grid', gap: 4, minWidth: 210 }}>
                      <textarea
                        aria-label="Resolution note"
                        placeholder="Resolution note (optional)…"
                        value={notes[row.id] ?? ''}
                        onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                        rows={2}
                        style={{ width: '100%', minHeight: 48, border: '1px solid #cbd5e1', borderRadius: 4, padding: 6, fontSize: 11, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionButton tone="success" disabled={working === row.id} onClick={() => void runAction(row.id, 'resolve')}>{working === row.id ? 'Saving…' : 'Resolve'}</ActionButton>
                        {row.status === 'open' && <ActionButton tone="warning" disabled={working === row.id} onClick={() => void runAction(row.id, 'escalate')}>Escalate</ActionButton>}
                      </div>
                    </div>
                  ) : <span key="done">Closed</span>,
                ];
              })}
              empty={<EmptyState title={loading ? 'Loading disputes…' : 'No disputes in this view'} description="Disputes raised against broker-managed loads appear here." />}
            />
          </div>
        </main>
      </div>
    </PageFrame>
  );
}
