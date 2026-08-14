'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState } from '../../components/workspace/WorkspaceUI';

type EventRow = {
  id: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });
}

function eventLabel(value: string | null) {
  return String(value ?? 'activity_update').replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function eventReference(event: EventRow) {
  const payload = event.payload ?? {};
  const candidates = [payload.job_ref, payload.invoice_number, payload.customer_reference, payload.booking_reference, payload.job_id, payload.invoice_id, event.entity_id];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof value === 'string' ? value : '—';
}

function payloadSummary(event: EventRow) {
  const payload = event.payload ?? {};
  const ignored = new Set(['job_id', 'invoice_id', 'bid_id', 'job_ref', 'invoice_number', 'customer_reference', 'booking_reference']);
  const parts = Object.entries(payload)
    .filter(([key, value]) => !ignored.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`);
  return parts.join(' · ') || '—';
}

export default function DriverEventLogPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [page, setPage] = useState(1);

  const loadEvents = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    let query = supabase
      .from('notification_events')
      .select('id, event_type, entity_type, entity_id, payload, created_at')
      .eq('recipient_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (fromDate) query = query.gte('created_at', new Date(`${fromDate}T00:00:00`).toISOString());
    if (toDate) query = query.lte('created_at', new Date(`${toDate}T23:59:59`).toISOString());
    const { data, error: fetchError } = await query;
    if (fetchError) {
      setEvents([]);
      setError('Event Log could not be loaded. Please refresh and try again.');
    } else setEvents((data ?? []) as EventRow[]);
    setLoading(false);
  }, [fromDate, toDate, userId]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const needle = appliedSearch.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => [eventLabel(event.event_type), event.entity_type, eventReference(event), payloadSummary(event)].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [appliedSearch, events]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleEvents = filteredEvents.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  useEffect(() => { setPage(1); }, [appliedSearch, fromDate, itemsPerPage, toDate]);

  const downloadCsv = () => {
    const rows = [
      ['Date', 'Event', 'Entity', 'Reference', 'Details'],
      ...filteredEvents.map((event) => [fmtDate(event.created_at), eventLabel(event.event_type), event.entity_type ?? '', eventReference(event), payloadSummary(event)]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `xdrive-event-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const searchRail = (
    <aside className="driver-filter-rail" aria-label="Event Log filters">
      <div className="driver-filter-rail__header">Search Event Log</div>
      <div className="driver-filter-rail__body">
        <div className="driver-filter-field"><label>From</label><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></div>
        <div className="driver-filter-field"><label>To</label><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
        <div className="driver-filter-field"><label>Event / Reference</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, quote, invoice or event" /></div>
        <div className="driver-filter-actions"><ActionButton tone="success" onClick={() => { setAppliedSearch(search); void loadEvents(); }}>Search</ActionButton><ActionButton tone="secondary" onClick={() => { setFromDate(''); setToDate(''); setSearch(''); setAppliedSearch(''); }}>Clear</ActionButton></div>
        <ActionButton tone="secondary" onClick={downloadCsv} disabled={filteredEvents.length === 0}>Download CSV</ActionButton>
        <ActionButton tone="secondary" onClick={() => window.print()} disabled={filteredEvents.length === 0}>Print / Save PDF</ActionButton>
        <div className="driver-detail-item"><span>Events in report</span><strong>{filteredEvents.length}</strong></div>
        <div className="driver-detail-item"><span>Latest event</span><strong>{filteredEvents[0]?.created_at ? fmtDate(filteredEvents[0].created_at) : '—'}</strong></div>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Search and export the operational events delivered to your driver account."
        headerActions={<ActionButton tone="primary" onClick={() => void loadEvents()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        <div className="driver-board-layout driver-event-log-board">
          {searchRail}
          <main className="driver-board-main">
            <div className="driver-board-summary">
              <span><strong>Event Log</strong> · {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}</span>
              <label>Items per Page: <select value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
            </div>
            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading Event Log…" /></div>
            ) : visibleEvents.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="There are no items to display" description="Adjust the date or reference filters and search again." /></div>
            ) : (
              <div className="driver-load-list">
                {visibleEvents.map((event) => (
                  <article key={event.id} className="driver-load-row">
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">Date</span><strong className="driver-cell-primary">{fmtDate(event.created_at)}</strong><span className="driver-cell-secondary">Account event</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Event</span><strong className="driver-cell-primary">{eventLabel(event.event_type)}</strong><span className="driver-cell-secondary">{event.entity_type ?? '—'}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Reference</span><strong className="driver-cell-primary">{eventReference(event)}</strong><span className="driver-cell-secondary">Entity {event.entity_id?.slice(0, 8).toUpperCase() ?? '—'}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Details</span><strong className="driver-cell-primary">{payloadSummary(event)}</strong><span className="driver-cell-secondary">Operational activity</span></div>
                    </div>
                    <div className="driver-load-row__meta"><span>Event #{event.id.slice(0, 8).toUpperCase()}</span></div>
                  </article>
                ))}
              </div>
            )}
            {filteredEvents.length > itemsPerPage && (
              <div className="driver-board-summary"><ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton><span>Page {safePage} / {totalPages}</span><ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton></div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
