'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type CompanyRelation = { name: string } | Array<{ name: string }> | null;
type TimeWindow = 'any' | '2' | '4' | '8' | '24';
type DateRange = 'any' | 'today' | '7d' | '30d';
type HistoryJob = {
  id: string; status: string; pickup_location: string | null; pickup_postcode: string | null; delivery_location: string | null; delivery_postcode: string | null;
  pickup_datetime: string | null; delivery_datetime: string | null; collection_window_start: string | null; delivery_window_start: string | null;
  deadline_at: string | null; budget_amount: number | null; updated_at: string | null; created_at: string | null; delivery_photos: string[] | null;
  customer_reference: string | null; booking_reference: string | null; companies: { name: string } | null;
};
type HistoryFilter = 'all' | 'allocated' | 'in_progress' | 'delivered' | 'cancelled' | 'disputed' | 'driver_declined';
type SearchFilters = { dateRange: DateRange; pickupWithin: TimeWindow; deliveryWithin: TimeWindow; loadRef: string; memberName: string };
const EMPTY_SEARCH: SearchFilters = { dateRange: 'any', pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', memberName: '' };
const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'allocated', label: 'Allocated' }, { id: 'in_progress', label: 'In Progress' },
  { id: 'delivered', label: 'Completed' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'disputed', label: 'Disputed' }, { id: 'driver_declined', label: 'Declined' },
];
const STATUS_LABELS: Record<string, string> = { allocated: 'Allocated', collected: 'Loaded', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled', disputed: 'Disputed', driver_declined: 'Declined' };
const STATUS_TONES: Record<string, 'blue' | 'green' | 'red' | 'purple' | 'orange'> = { allocated: 'blue', collected: 'blue', in_transit: 'blue', delivered: 'green', cancelled: 'red', disputed: 'purple', driver_declined: 'orange' };
const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' }, { value: '2', label: '2 hours' }, { value: '4', label: '4 hours' }, { value: '8', label: '8 hours' }, { value: '24', label: '24 hours' },
];
function normalizeCompany(value: CompanyRelation) { return !value ? null : Array.isArray(value) ? (value[0] ?? null) : value; }
function fmtDate(value: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function money(value: number) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value); }
function withinHours(value: string | null, window: TimeWindow) { if (window === 'any') return true; if (!value) return false; const timestamp = new Date(value).getTime(); return !Number.isNaN(timestamp) && timestamp >= Date.now() && timestamp <= Date.now() + Number(window) * 60 * 60 * 1000; }
function withinDateRange(value: string | null, range: DateRange) { if (range === 'any') return true; if (!value) return false; const timestamp = new Date(value).getTime(); if (Number.isNaN(timestamp)) return false; const now = new Date(); if (range === 'today') { const target = new Date(value); return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth() && target.getDate() === now.getDate(); } return timestamp >= Date.now() - (range === '7d' ? 7 : 30) * 86400000; }
function filterMatches(job: HistoryJob, filter: HistoryFilter) { if (filter === 'all') return true; if (filter === 'in_progress') return ['collected', 'in_transit'].includes(job.status); return job.status === filter; }

export default function JobHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');
  const [search, setSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || authLoading) return;
    if (!driverId) { setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: fetchError } = await supabase.from('jobs').select('id, status, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, collection_window_start, delivery_window_start, deadline_at, budget_amount, updated_at, created_at, delivery_photos, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)').eq('assigned_driver_id', driverId).in('status', ['allocated', 'collected', 'in_transit', 'delivered', 'cancelled', 'disputed', 'driver_declined']).order('updated_at', { ascending: false }).limit(250);
    if (fetchError) { setError('Diary records could not be loaded. Please refresh and try again.'); setJobs([]); }
    else setJobs(((data ?? []) as unknown as Array<Omit<HistoryJob, 'companies'> & { companies: CompanyRelation }>).map((job) => ({ ...job, companies: normalizeCompany(job.companies) })));
    setLoading(false);
  }, [authLoading, driverId]);
  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  const searchedJobs = useMemo(() => jobs.filter((job) => {
    const refDate = job.pickup_datetime ?? job.collection_window_start ?? job.updated_at ?? job.created_at;
    if (!withinDateRange(refDate, appliedSearch.dateRange)) return false;
    if (!withinHours(job.pickup_datetime ?? job.collection_window_start, appliedSearch.pickupWithin)) return false;
    if (!withinHours(job.delivery_datetime ?? job.delivery_window_start, appliedSearch.deliveryWithin)) return false;
    const refNeedle = appliedSearch.loadRef.trim().toLowerCase(); const memberNeedle = appliedSearch.memberName.trim().toLowerCase();
    if (refNeedle && ![job.id, job.customer_reference, job.booking_reference].filter(Boolean).join(' ').toLowerCase().includes(refNeedle)) return false;
    if (memberNeedle && !(job.companies?.name ?? '').toLowerCase().includes(memberNeedle)) return false;
    return true;
  }), [appliedSearch, jobs]);
  const visibleFiltered = useMemo(() => searchedJobs.filter((job) => filterMatches(job, statusFilter)), [searchedJobs, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleFiltered.length / itemsPerPage)); const safePage = Math.min(page, totalPages);
  const visibleJobs = visibleFiltered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
  useEffect(() => { setPage(1); }, [statusFilter, appliedSearch, itemsPerPage]);
  const allExpanded = visibleJobs.length > 0 && visibleJobs.every((job) => expandedIds.has(job.id));
  const toggleExpandAll = () => setExpandedIds((previous) => { const next = new Set(previous); visibleJobs.forEach((job) => allExpanded ? next.delete(job.id) : next.add(job.id)); return next; });

  const filterRail = <aside className="driver-filter-rail" aria-label="Diary search filters">
    <div className="driver-filter-rail__header">Search Diary</div>
    <div className="driver-filter-rail__body">
      <div className="driver-filter-field"><label>Date</label><select value={search.dateRange} onChange={(e) => setSearch((c) => ({ ...c, dateRange: e.target.value as DateRange }))}><option value="any">Anytime</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></div>
      <div className="driver-filter-field"><label>Pickup Time Within</label><select value={search.pickupWithin} onChange={(e) => setSearch((c) => ({ ...c, pickupWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      <div className="driver-filter-field"><label>Delivery Time Within</label><select value={search.deliveryWithin} onChange={(e) => setSearch((c) => ({ ...c, deliveryWithin: e.target.value as TimeWindow }))}>{TIME_WINDOWS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      <div className="driver-filter-field"><label>Load ID / Ref</label><input value={search.loadRef} onChange={(e) => setSearch((c) => ({ ...c, loadRef: e.target.value }))} placeholder="Job, booking or ref" /></div>
      <div className="driver-filter-field"><label>Member / Customer</label><input value={search.memberName} onChange={(e) => setSearch((c) => ({ ...c, memberName: e.target.value }))} placeholder="Company name" /></div>
      <div className="driver-filter-actions"><ActionButton tone="success" onClick={() => setAppliedSearch(search)}>Search</ActionButton><ActionButton tone="secondary" onClick={() => { setSearch(EMPTY_SEARCH); setAppliedSearch(EMPTY_SEARCH); }}>Clear</ActionButton></div>
      <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Payment Report</ActionButton>
    </div>
  </aside>;

  return <ProtectedRoute allowedRoles={['driver']}>
    <DriverWorkspaceShell subtitle="All allocated, in-progress and closed bookings in one searchable operational diary." headerActions={<ActionButton tone="primary" onClick={() => void fetchHistory()} disabled={loading}>Refresh</ActionButton>}>
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      <div className="driver-board-layout driver-diary-board">
        {filterRail}
        <main className="driver-board-main">
          <div className="driver-tab-strip" role="tablist" aria-label="Diary states">{FILTERS.map((item) => <button key={item.id} type="button" data-active={statusFilter === item.id ? 'true' : 'false'} onClick={() => setStatusFilter(item.id)}>{item.label} <span>{searchedJobs.filter((job) => filterMatches(job, item.id)).length}</span></button>)}</div>
          <div className="driver-board-summary"><span>{visibleFiltered.length} booking{visibleFiltered.length === 1 ? '' : 's'} · showing {visibleJobs.length}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button type="button" onClick={toggleExpandAll} disabled={!visibleJobs.length} style={{ border: 0, background: 'transparent', color: visibleJobs.length ? '#1d57d8' : '#94a3b8', fontWeight: 700 }}>{allExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button><label>Items per Page: <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label></span></div>
          {loading ? <div className="driver-load-row"><EmptyState compact title="Loading diary…" /></div>
            : visibleJobs.length === 0 ? <div className="driver-load-row"><EmptyState compact title="No bookings in this view" description="Adjust the status or search filters." /></div>
            : <div className="driver-load-list">{visibleJobs.map((job) => {
              const expanded = expandedIds.has(job.id); const hasPod = Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0;
              const closedDate = job.delivery_datetime ?? job.updated_at ?? job.deadline_at ?? job.delivery_window_start ?? job.created_at;
              return <article key={job.id} className="driver-load-row" data-state={job.status}>
                <div className="driver-load-row__top">
                  <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{job.pickup_location ?? 'Collection'}</strong><span className="driver-cell-secondary">{job.pickup_postcode ?? '—'} · {fmtDate(job.pickup_datetime ?? job.collection_window_start)}</span></div>
                  <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{job.delivery_location ?? 'Delivery'}</strong><span className="driver-cell-secondary">{job.delivery_postcode ?? '—'} · {fmtDate(closedDate)}</span></div>
                  <div className="driver-load-cell"><span className="driver-cell-label">Commercial</span><strong className="driver-cell-primary">{job.budget_amount != null ? money(job.budget_amount) : '—'}</strong><span className="driver-cell-secondary">{job.companies?.name ?? 'Member not supplied'}</span></div>
                  <div className="driver-load-cell"><span className="driver-cell-label">Status</span><strong className="driver-cell-primary">{STATUS_LABELS[job.status] ?? job.status}</strong><span className="driver-cell-secondary">{hasPod ? 'POD captured' : 'POD not captured'}</span></div>
                </div>
                <div className="driver-load-row__meta"><span>Job #{job.id.slice(0, 8).toUpperCase()}</span>{job.booking_reference && <span>Booking: {job.booking_reference}</span>}{job.customer_reference && <span>Customer ref: {job.customer_reference}</span>}<StatusBadge value={STATUS_LABELS[job.status] ?? job.status} tone={STATUS_TONES[job.status]} />{hasPod && <StatusBadge value="POD captured" tone="green" />}<div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => setExpandedIds((p) => { const n = new Set(p); n.has(job.id) ? n.delete(job.id) : n.add(job.id); return n; })}>{expanded ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open job</ActionButton></div></div>
                {expanded && <div className="driver-row-details"><div className="driver-detail-grid"><div className="driver-detail-item"><span>Booked by</span><strong>{job.companies?.name ?? '—'}</strong></div><div className="driver-detail-item"><span>Customer ref</span><strong>{job.customer_reference ?? '—'}</strong></div><div className="driver-detail-item"><span>Booking ref</span><strong>{job.booking_reference ?? '—'}</strong></div><div className="driver-detail-item"><span>Route postcodes</span><strong>{job.pickup_postcode ?? '—'} → {job.delivery_postcode ?? '—'}</strong></div></div><div className="driver-row-actions" style={{ marginTop: 6 }}><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>POD</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Order</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Notes</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>History</ActionButton><ActionButton tone="secondary" onClick={() => router.push('/driver/documents')}>Documents</ActionButton>{job.status === 'delivered' && <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>View invoice (£)</ActionButton>}</div></div>}
              </article>;
            })}</div>}
          {visibleFiltered.length > itemsPerPage && <div className="driver-board-summary"><ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</ActionButton><span>Page {safePage} / {totalPages}</span><ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</ActionButton></div>}
        </main>
      </div>
    </DriverWorkspaceShell>
  </ProtectedRoute>;
}
