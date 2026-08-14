'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { isSupabaseConfigured, supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type ActionCentreEvent = {
  id: string;
  event_type: string;
  entity_type: string | null;
  status: string;
  created_at: string;
  event_id: string | null;
  cta_href: string;
};

type ViewId = 'all' | 'open' | 'failed';
type DateRange = '24h' | '7d' | '30d';

const views: Array<{ id: ViewId; label: string }> = [
  { id: 'all', label: 'All events' },
  { id: 'open', label: 'Open actions' },
  { id: 'failed', label: 'Failed only' },
];

function isPendingStatus(status: string) {
  const value = status.toLowerCase();
  return value === 'pending' || value === 'queued' || value === 'in_progress';
}

function formatLabel(value: string | null | undefined) {
  return String(value ?? 'Operational event').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DriverActionCentrePage() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewId>('all');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [rows, setRows] = useState<ActionCentreEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRows = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      setRows([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setRows([]);
        setError('Authentication required.');
        return;
      }

      const response = await fetch('/api/workspace/action-centre?role=driver&limit=100', {
        method: 'GET',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as { items?: ActionCentreEvent[]; error?: string };
      if (!response.ok) {
        setRows([]);
        setError(payload.error || 'Unable to load Action Centre.');
      } else {
        setRows(Array.isArray(payload.items) ? payload.items : []);
      }
    } catch {
      setRows([]);
      setError('Unable to load Action Centre.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  const since = useMemo(() => {
    const duration = dateRange === '24h' ? 24 * 60 * 60 * 1000 : dateRange === '30d' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return Date.now() - duration;
  }, [dateRange]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (new Date(row.created_at).getTime() < since) return false;
    if (view === 'open') return row.status !== 'sent' && row.status !== 'resolved';
    if (view === 'failed') return row.status === 'failed';
    return true;
  }), [rows, since, view]);

  const counts = useMemo(() => ({
    all: rows.filter((row) => new Date(row.created_at).getTime() >= since).length,
    open: rows.filter((row) => new Date(row.created_at).getTime() >= since && row.status !== 'sent' && row.status !== 'resolved').length,
    failed: rows.filter((row) => new Date(row.created_at).getTime() >= since && row.status === 'failed').length,
  }), [rows, since]);

  const rail = (
    <aside className="driver-filter-rail" aria-label="Action Centre filters">
      <div className="driver-filter-rail__header">Action Centre</div>
      <div className="driver-filter-rail__body">
        <div className="driver-filter-field"><label>Date range</label><select value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></div>
        {views.map((item) => (
          <button key={item.id} type="button" className="driver-account-link" data-active={view === item.id ? 'true' : 'false'} onClick={() => setView(item.id)}>
            <span><strong>{item.label}</strong><small>Operational queue</small></span><span>{counts[item.id]}</span>
          </button>
        ))}
        <ActionButton tone="secondary" disabled={loading} onClick={() => void loadRows()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        driverName="Action Centre"
        subtitle="Prioritised driver actions requiring review or acknowledgement."
        headerActions={<ActionButton tone="primary" disabled={loading} onClick={() => void loadRows()}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        <div className="driver-board-layout driver-action-centre-board">
          {rail}
          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Action queue views">
              {views.map((item) => <button key={item.id} type="button" data-active={view === item.id ? 'true' : 'false'} onClick={() => setView(item.id)}>{item.label} <span>{counts[item.id]}</span></button>)}
            </div>
            <div className="driver-board-summary"><span>{filteredRows.length} action{filteredRows.length === 1 ? '' : 's'} in selected view</span></div>
            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading Action Centre…" /></div>
            ) : filteredRows.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No actions in this view" description="There are no driver actions matching the selected status and date range." /></div>
            ) : (
              <div className="driver-load-list">
                {filteredRows.slice(0, 100).map((row) => {
                  const pending = isPendingStatus(row.status);
                  const tone = row.status === 'failed' ? 'red' : pending ? 'orange' : 'green';
                  return (
                    <article key={row.id} className="driver-load-row" data-state={row.status}>
                      <div className="driver-load-row__top">
                        <div className="driver-load-cell"><span className="driver-cell-label">Action</span><strong className="driver-cell-primary">{formatLabel(row.event_type)}</strong><span className="driver-cell-secondary">{formatLabel(row.entity_type)}</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Reference</span><strong className="driver-cell-primary">{row.event_id?.slice(0, 8).toUpperCase() ?? row.id.slice(0, 8).toUpperCase()}</strong><span className="driver-cell-secondary">Operational event</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Created</span><strong className="driver-cell-primary">{formatDate(row.created_at)}</strong><span className="driver-cell-secondary">Driver queue</span></div>
                        <div className="driver-load-cell"><span className="driver-cell-label">Status</span><strong className="driver-cell-primary">{formatLabel(row.status)}</strong><span className="driver-cell-secondary"><StatusBadge value={formatLabel(row.status)} tone={tone} /></span></div>
                      </div>
                      <div className="driver-load-row__meta"><span>Action #{row.id.slice(0, 8).toUpperCase()}</span><StatusBadge value={formatLabel(row.status)} tone={tone} /><div className="driver-row-actions">{row.cta_href ? <ActionButton tone="secondary" onClick={() => { window.location.href = row.cta_href; }}>Open details</ActionButton> : null}</div></div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
