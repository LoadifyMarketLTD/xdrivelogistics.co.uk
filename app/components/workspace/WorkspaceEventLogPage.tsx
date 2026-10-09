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

function actorLabel(event: EventRow) {
  const payload = event.payload ?? {};
  const name = typeof payload.actor_name === 'string' ? payload.actor_name.trim() : '';
  if (name) return name;
  const email = typeof payload.actor_email === 'string' ? payload.actor_email.trim() : '';
  if (email) return email;
  const actorId = typeof payload.actor_user_id === 'string' ? payload.actor_user_id.trim() : '';
  if (actorId) return UUID_RE.test(actorId) ? actorId.slice(0, 8).toUpperCase() : actorId;
  return event.source === 'notification' ? 'System / notification' : '—';
}

function sourceLabel(source: string | undefined) {
  const labels: Record<string, string> = {
    notification: 'Account notification',
    tracking: 'Operational tracking',
    company_audit: 'Company audit',
    invoice_status: 'Invoice status',
    invoice_payment: 'Invoice payment',
    workspace: 'Workspace access',
  };
  return labels[source ?? ''] ?? eventLabel(source ?? 'activity');
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
    'actor_user_id',
    'actor_name',
    'actor_email',
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
  const [sourceFilter, setSourceFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
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

  const sourceOptions = useMemo(() => [...new Set(events.map((event) => event.source).filter((value): value is string => Boolean(value)))].sort(), [events]);
  const entityOptions = useMemo(() => [...new Set(events.map((event) => event.entity_type).filter((value): value is string => Boolean(value)))].sort(), [events]);

  const filteredEvents = useMemo(() => {
    const needle = appliedSearch.trim().toLowerCase();
    return events.filter((event) => {
      if (sourceFilter !== 'all' && event.source !== sourceFilter) return false;
      if (entityFilter !== 'all' && event.entity_type !== entityFilter) return false;
      if (!needle) return true;
      return [
        eventLabel(event.event_type),
        event.entity_type,
        eventReference(event),
        payloadSummary(event),
        event.source,
        actorLabel(event),
      ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [appliedSearch, entityFilter, events, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleEvents = filteredEvents.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [appliedSearch, entityFilter, fromDate, itemsPerPage, sourceFilter, toDate]);

  const downloadCsv = () => {
    const rows = [
      ['Date', 'Event', 'Entity', 'Reference', 'Actor', 'Source', 'Details'],
      ...filteredEvents.map((event) => [
        fmtDate(event.created_at),
        eventLabel(event.event_type),
        event.entity_type ?? '',
        eventReference(event),
        actorLabel(event),
        sourceLabel(event.source),
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
    setSourceFilter('all');
    setEntityFilter('all');
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
            <label>EVENT / REFERENCE / ACTOR<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, invoice, event or actor" /></label>
            <label>SOURCE<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All sources</option>{sourceOptions.map((value) => <option key={value} value={value}>{sourceLabel(value)}</option>)}</select></label>
            <label>ENTITY<select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}><option value="all">All entities</option>{entityOptions.map((value) => <option key={value} value={value}>{eventLabel(value)}</option>)}</select></label>
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
          <div className="workspace-record-meta workspace-list-controls" style={{ justifyContent: 'space-between' }}>
            <span><strong>Event Log</strong> · {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}</span>
            <span className="workspace-list-controls__right">
              <label>Items per Page
                <select value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
              <span>{filteredEvents.length === 0 ? '0' : `${(safePage - 1) * itemsPerPage + 1}-${Math.min(safePage * itemsPerPage, filteredEvents.length)} of ${filteredEvents.length}`}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button>
            </span>
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
                    <div className="workspace-operational-cell"><span style={cellLabelStyle}>ACTOR</span><strong style={cellPrimaryStyle}>{actorLabel(event)}</strong><div style={cellMetaStyle}>{sourceLabel(event.source)}</div></div>
                    <div className="workspace-operational-cell"><span style={cellLabelStyle}>DETAILS</span><strong style={cellPrimaryStyle}>{payloadSummary(event)}</strong><div style={cellMetaStyle}>Operational activity</div></div>
                  </div>
                  <div className="workspace-record-meta"><span>Event #{event.id.slice(0, 8).toUpperCase()}</span><span>Source: {sourceLabel(event.source)}</span>{replayJobId ? <ActionButton tone="secondary" onClick={() => window.location.assign(`/job-replay/${replayJobId}`)}>Open Replay</ActionButton> : null}</div>
                </article>
                );
              })}
            </div>
          )}

        </main>
      </div>
    </PageFrame>
  );
}
