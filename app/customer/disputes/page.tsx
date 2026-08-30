'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthContext';
import { useCompanyWorkspaceData } from '../../components/workspace/useCompanyWorkspaceData';
import { supabase } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  DataTable,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type Dispute = {
  id: string;
  job_id: string;
  status: string;
  description: string;
  resolution_note?: string | null;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
};

const terminalStates = new Set(['completed', 'delivered', 'cancelled', 'failed', 'exception', 'disputed']);
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

export default function CustomerDisputesPage() {
  const { user } = useAuth();
  const data = useCompanyWorkspaceData();
  const [rows, setRows] = useState<Dispute[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const authHeader = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    return token ? `Bearer ${token}` : null;
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    const auth = await authHeader();
    if (!auth) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }
    const response = await fetch('/api/customer/disputes', { headers: { Authorization: auth } });
    const payload = await response.json().catch(() => ({})) as { disputes?: Dispute[]; error?: string };
    if (!response.ok) setError(payload.error ?? 'Disputes could not be loaded.');
    else setRows(payload.disputes ?? []);
    setLoading(false);
  }, [authHeader, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const eligibleJobs = useMemo(() => data.jobs.filter((job) => {
    const state = String(job.current_status ?? job.status ?? '').toLowerCase();
    return terminalStates.has(state);
  }), [data.jobs]);

  const submit = async () => {
    setError('');
    setNotice('');
    if (!selectedJobId || description.trim().length < 10) {
      setError('Choose an eligible job and enter at least 10 characters describing the issue.');
      return;
    }
    const auth = await authHeader();
    if (!auth) {
      setError('Session expired. Please sign in again.');
      return;
    }
    setSaving(true);
    const response = await fetch('/api/customer/disputes', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: selectedJobId, description: description.trim() }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error ?? 'The dispute could not be raised.');
      return;
    }
    setSelectedJobId('');
    setDescription('');
    setNotice('Dispute raised and linked to the selected booking.');
    await load();
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Booking support"
        title="Feedback & Disputes"
        description="Raise and track booking disputes. Trading-partner reputation remains a separate verified feedback contract."
        actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      />

      {data.error && <AlertBanner>{data.error}</AlertBanner>}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Raise a booking dispute">
          <div className="workspace-filter-rail__header">Raise Dispute</div>
          <div className="workspace-filter-rail__body">
            <label>
              JOB
              <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
                <option value="">Choose completed / exception job</option>
                {eligibleJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.id.slice(0, 8).toUpperCase()} · {job.pickup_postcode ?? job.pickup_location ?? 'Collection'} → {job.delivery_postcode ?? job.delivery_location ?? 'Delivery'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ISSUE
              <textarea
                rows={5}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what happened and what needs investigation."
              />
            </label>
            <ActionButton tone="warning" disabled={saving || !selectedJobId} onClick={() => void submit()}>
              {saving ? 'Submitting…' : 'Raise dispute'}
            </ActionButton>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: '#64748b' }}>
              Only jobs in your customer workspace can be submitted. The server verifies the job relationship before creating the dispute.
            </p>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div className="workspace-record-meta">
            <span><strong>{rows.length}</strong> dispute{rows.length === 1 ? '' : 's'}</span>
            <span>Customer booking scope only</span>
          </div>
          <div className="workspace-panel">
            <DataTable
              columns={['Job', 'Issue', 'Opened', 'Status', 'Resolution']}
              rows={rows.map((row) => [
                <strong key="job">{row.job_id.slice(0, 8).toUpperCase()}</strong>,
                row.description,
                when(row.created_at),
                <StatusBadge key="status" value={row.status} tone={['resolved', 'closed'].includes(row.status) ? 'green' : row.status === 'investigating' ? 'orange' : 'red'} />,
                row.resolution_note ?? 'Pending investigation',
              ])}
              empty={<EmptyState title={loading ? 'Loading disputes…' : 'No disputes'} description="Booking disputes raised by your customer company appear here." />}
            />
          </div>
        </main>
      </div>
    </PageFrame>
  );
}
