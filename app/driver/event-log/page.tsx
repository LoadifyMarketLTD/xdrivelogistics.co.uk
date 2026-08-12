'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, KpiCard, KpiGrid, Panel } from '../../components/workspace/WorkspaceUI';

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
  return String(value ?? 'activity_update')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
    } else {
      setEvents((data ?? []) as EventRow[]);
    }
    setLoading(false);
  }, [fromDate, toDate, userId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const needle = appliedSearch.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => {
      const haystack = [eventLabel(event.event_type), event.entity_type, eventReference(event), payloadSummary(event)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [appliedSearch, events]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleEvents = filteredEvents.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [appliedSearch, fromDate, itemsPerPage, toDate]);

  const downloadCsv = () => {
    const rows = [
      ['Date', 'Event', 'Entity', 'Reference', 'Details'],
      ...filteredEvents.map((event) => [
        fmtDate(event.created_at),
        eventLabel(event.event_type),
        event.entity_type ?? '',
        eventReference(event),
        payloadSummary(event),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `xdrive-event-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Search and export the operational events delivered to your driver account."
        headerActions={<ActionButton tone="primary" onClick={() => void loadEvents()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}

        <KpiGrid>
          <KpiCard label="Events" value={filteredEvents.length} detail="Current filtered report" tone="blue" />
          <KpiCard label="Job events" value={filteredEvents.filter((event) => String(event.entity_type ?? '').includes('job')).length} detail="Job-related activity" tone="navy" />
          <KpiCard label="Quote events" value={filteredEvents.filter((event) => String(event.entity_type ?? '').includes('bid') || String(event.event_type ?? '').includes('bid') || String(event.event_type ?? '').includes('quote')).length} detail="Commercial activity" tone="orange" />
          <KpiCard label="Latest" value={filteredEvents[0]?.created_at ? fmtDate(filteredEvents[0].created_at) : '—'} detail="Most recent event" tone="green" />
        </KpiGrid>

        <Panel title="Event Log Activity Report" description="Filter the activity report by date or reference and export the current result.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: '4px', color: '#64748b', fontSize: '10px', fontWeight: 700 }}>From
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: '4px', color: '#64748b', fontSize: '10px', fontWeight: 700 }}>To
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: '4px', color: '#64748b', fontSize: '10px', fontWeight: 700 }}>Event / Reference
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, quote, invoice or event" />
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <ActionButton tone="success" onClick={() => { setAppliedSearch(search); void loadEvents(); }}>Search</ActionButton>
              <ActionButton tone="secondary" onClick={() => { setFromDate(''); setToDate(''); setSearch(''); setAppliedSearch(''); }}>Clear</ActionButton>
              <ActionButton tone="secondary" onClick={downloadCsv} disabled={filteredEvents.length === 0}>Download CSV</ActionButton>
              <ActionButton tone="secondary" onClick={() => window.print()} disabled={filteredEvents.length === 0}>Print / Save PDF</ActionButton>
            </div>
          </div>
        </Panel>

        <Panel
          title="Event Log"
          actions={(
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '11px' }}>
              Items per Page
              <select value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          )}
          flush
        >
          {loading ? (
            <div style={{ padding: '20px' }}><EmptyState title="Loading Event Log" /></div>
          ) : visibleEvents.length === 0 ? (
            <div style={{ padding: '20px' }}><EmptyState title="There are no items to display" description="Adjust the date or reference filters and search again." /></div>
          ) : (
            <div className="driver-ops-table-wrap">
              <table className="driver-ops-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Entity</th>
                    <th>Reference</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{fmtDate(event.created_at)}</td>
                      <td><strong>{eventLabel(event.event_type)}</strong></td>
                      <td>{event.entity_type ?? '—'}</td>
                      <td>{eventReference(event)}</td>
                      <td>{payloadSummary(event)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredEvents.length > itemsPerPage && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '8px 10px', borderTop: '1px solid #e5e7eb' }}>
              <ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Page {safePage} of {totalPages}</span>
              <ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton>
            </div>
          )}
        </Panel>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
