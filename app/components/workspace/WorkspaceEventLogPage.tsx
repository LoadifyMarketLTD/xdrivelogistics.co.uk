'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, PageFrame, PageHeader } from './WorkspaceUI';

type EventRow = {
  id: string;
  event_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  source?: 'notification' | 'tracking' | string;
  job_id?: string | null;
};

const cellLabelStyle = {
  display: 'block',
  color: '#526176',
  fontSize: 11,
  lineHeight: '14px',
  fontWeight: 650,
} as const;

const cellPrimaryStyle = {
  display: 'block',
  color: '#172033',
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: 650,
  overflowWrap: 'anywhere',
} as const;

const cellMetaStyle = {
  color: '#64748b',
  fontSize: 11,
  lineHeight: '15px',
  overflowWrap: 'anywhere',
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const candidates = [
    payload.job_ref,
    payload.invoice_number,
    payload.customer_reference,
    payload.booking_reference,
    payload.job_id,
    payload.invoice_id,
    event.entity_id,
  ];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  if (typeof value !== 'string') return '—';
  return UUID_RE.test(value) ? value.slice(0, 8).toUpperCase() : value;
}

function detailKey(key: string) {
  const labels: Record<string, string> = {
    bid_amount: 'Quote',
    bid_price_gbp: 'Quote',
    amount: 'Amount',
    status: 'Status',
    source: 'Source',
    email: 'Email',
    driver_id: 'Driver',
    driver_user_id: 'Driver user',
    company_id: 'Company',
    recipient_name: 'Recipient',
    delivery_status: 'Delivery status',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function detailValue(value: unknown) {
  if (typeof value === 'string' && UUID_RE.test(value)) return value.slice(0, 8).toUpperCase();
  return String(value);
}

function payloadSummary(event: EventRow) {
  const payload = event.payload ?? {};
  const ignored = new Set([
    'job_id',
    'invoice_id',
    'bid_id',
    'job_ref',
    'invoice_number',
    'customer_reference',
    'booking_reference',
  ]);
  const parts = Object.entries(payload)
    .filter(([key, value]) => !ignored.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => `${detailKey(key)}: ${detailValue(value)}`);
  return parts.join(' · ') || 'No additional details';
}

export function WorkspaceEventLogPage({
  eyebrow = 'Operational audit',
  title = 'Event Log',
  description = 'Search and export operational events delivered to your authenticated account.',
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
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
    if (!userId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setEvents([]); setError('Your session has expired.'); setLoading(false); return; }
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    try {
      const response = await fetch(`/api/workspace/event-log?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { events?: EventRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Event Log could not be loaded.');
      setEvents(payload.events ?? []);
    } catch (reason) {
      setEvents([]);
      setError(reason instanceof Error ? reason.message : 'Event Log could not be loaded. Please refresh and try again.');
    }
    setLoading(false);
  }, [fromDate, toDate, userId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const needle = appliedSearch.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => [
      eventLabel(event.event_type),
      event.entity_type,
      eventReference(event),
      payloadSummary(event),
      event.source,
    ].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [appliedSearch, events]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleEvents = filteredEvents.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [appliedSearch, fromDate, itemsPerPage, toDate]);

  const downloadCsv = () => {
    const rows = [
      ['Date', 'Event', 'Entity', 'Reference', 'Source', 'Details'],
      ...filteredEvents.map((event) => [
        fmtDate(event.created_at),
        eventLabel(event.event_type),
        event.entity_type ?? '',
        eventReference(event),
        event.source ?? '',
        payloadSummary(event),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `xdrive-event-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clear = () => {
    setFromDate('');
    setToDate('');
    setSearch('');
    setAppliedSearch('');
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={<ActionButton tone="primary" onClick={() => void loadEvents()} disabled={loading}>Refresh</ActionButton>}
      />

      {error && <AlertBanner tone="danger">{error}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Event Log filters">
          <div className="workspace-filter-rail__header">Search Event Log</div>
          <div className="workspace-filter-rail__body">
            <label>FROM<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label>TO<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            <label>EVENT / REFERENCE<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, quote, invoice or event" /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <ActionButton tone="success" onClick={() => { setAppliedSearch(search); void loadEvents(); }}>Search</ActionButton>
              <ActionButton tone="secondary" onClick={clear}>Clear</ActionButton>
            </div>
            <ActionButton tone="secondary" onClick={downloadCsv} disabled={filteredEvents.length === 0}>Download CSV</ActionButton>
            <ActionButton tone="secondary" onClick={() => window.print()} disabled={filteredEvents.length === 0}>Print / Save PDF</ActionButton>
            <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span>Events</span><strong>{filteredEvents.length}</strong></div>
            <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span>Latest</span><strong>{filteredEvents[0]?.created_at ? fmtDate(filteredEvents[0].created_at) : '—'}</strong></div>
          </div>
        </aside>

        <main className="workspace-board-main">
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
            <span><strong>Event Log</strong> · {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Items per Page
              <select value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))} style={{ height: 28, border: '1px solid var(--ws-border)', borderRadius: 4, background: '#fff' }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Event Log…" /></div>
          ) : visibleEvents.length === 0 ? (
            <div className="workspace-panel"><EmptyState compact title="There are no items to display" description="Adjust the date or reference filters and search again." /></div>
          ) : (
            <div className="workspace-record-list">
              {visibleEvents.map((event) => {
                const replayJobId = event.job_id && UUID_RE.test(event.job_id) ? event.job_id : null;
                return (
                <article key={event.id} className="workspace-operational-row">
                  <div className="workspace-operational-row__top">
                    <div className="workspace-operational-cell"><span style={cellLabelStyle}>DATE</span><strong style={cellPrimaryStyle}>{fmtDate(event.created_at)}</strong><div style={cellMetaStyle}>Account event</div></div>
                    <div className="workspace-operational-cell"><span style={cellLabelStyle}>EVENT</span><strong style={cellPrimaryStyle}>{eventLabel(event.event_type)}</strong><div style={cellMetaStyle}>{event.entity_type ?? '—'}</div></div>
                    <div className="workspace-operational-cell"><span style={cellLabelStyle}>REFERENCE</span><strong style={cellPrimaryStyle}>{eventReference(event)}</strong><div style={cellMetaStyle}>Entity {event.entity_id ? event.entity_id.slice(0, 8).toUpperCase() : '—'}</div></div>
                    <div className="workspace-operational-cell"><span style={cellLabelStyle}>DETAILS</span><strong style={cellPrimaryStyle}>{payloadSummary(event)}</strong><div style={cellMetaStyle}>Operational activity</div></div>
                  </div>
                  <div className="workspace-record-meta"><span>Event #{event.id.slice(0, 8).toUpperCase()}</span><span>Source: {event.source ?? 'notification'}</span>{replayJobId ? <ActionButton tone="secondary" onClick={() => window.location.assign(`/job-replay/${replayJobId}`)}>Open Replay</ActionButton> : null}</div>
                </article>
                );
              })}
            </div>
          )}

          {filteredEvents.length > itemsPerPage && (
            <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
              <ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton>
              <span>Page {safePage} / {totalPages}</span>
              <ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton>
            </div>
          )}
        </main>
      </div>
    </PageFrame>
  );
}
