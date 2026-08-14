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
type HistoryFilter = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'awaiting_feedback' | 'recent_feedback';
type DetailTab = 'pod' | 'order' | 'notes' | 'history' | 'documents' | 'invoice';
type StatusHistoryEntry = { status?: string | null; timestamp?: string | null; at?: string | null };

type HistoryJob = {
  id: string;
  status: string;
  assigned_driver_id: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  pickup_datetime: string | null;
  delivery_datetime: string | null;
  collection_window_start: string | null;
  delivery_window_start: string | null;
  deadline_at: string | null;
  budget_amount: number | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  load_details: string | null;
  load_notes: string | null;
  collection_notes: string | null;
  delivery_notes: string | null;
  driver_notes: string | null;
  hard_copy_pod: string | null;
  pod_required: boolean | null;
  pod_generated: boolean | null;
  pod_generated_at: string | null;
  pod_photos: unknown[] | null;
  delivery_photos: string[] | null;
  status_history: StatusHistoryEntry[] | null;
  feedback_status: string | null;
  broker_pod_review_status: string | null;
  broker_pod_review_note: string | null;
  updated_at: string | null;
  created_at: string | null;
  customer_reference: string | null;
  booking_reference: string | null;
  companies: { name: string } | null;
};

type ReviewRow = { id: string; job_id: string | null; rating: number | null; comment: string | null; created_at: string | null };
type InvoiceRow = { id: string; job_id: string | null; invoice_number: string | null; status: string | null; payment_status: string | null; total: number | null; amount: number | null; due_date: string | null; created_at: string | null };
type DocumentRow = { id: string; job_id: string | null; file_name: string | null; file_type: string | null; file_url: string | null; uploaded_at: string | null };
type TrackingEventRow = { id: string; job_id: string | null; event_type: string | null; event_time: string | null; user_name: string | null; notes: string | null; message: string | null };
type SearchFilters = { dateRange: DateRange; pickupWithin: TimeWindow; deliveryWithin: TimeWindow; loadRef: string; memberName: string };

const EMPTY_SEARCH: SearchFilters = { dateRange: 'any', pickupWithin: 'any', deliveryWithin: 'any', loadRef: '', memberName: '' };
const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
  { id: 'awaiting_feedback', label: 'Awaiting Feedback' },
  { id: 'recent_feedback', label: 'Recent Feedback' },
];
const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'pod', label: 'POD' },
  { id: 'order', label: 'Order' },
  { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' },
  { id: 'documents', label: 'Documents' },
  { id: 'invoice', label: 'Invoice' },
];
const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '24 hours' },
];
const ALLOCATED_STATUSES = new Set(['awarded', 'allocated', 'accepted']);
const IN_PROGRESS_STATUSES = new Set(['collected', 'loaded', 'in_transit', 'on_my_way_to_pickup', 'on_site_pickup', 'on_my_way_to_delivery', 'on_site_delivery']);
const COMPLETED_STATUSES = new Set(['delivered', 'completed']);
const CANCELLED_STATUSES = new Set(['cancelled', 'driver_declined']);
const STATUS_LABELS: Record<string, string> = {
  posted: 'Posted', quoted: 'Quoted', awarded: 'Awarded', allocated: 'Allocated', accepted: 'Accepted',
  collected: 'Loaded', loaded: 'Loaded', in_transit: 'In transit', delivered: 'Delivered', completed: 'Completed',
  cancelled: 'Cancelled', disputed: 'Disputed', driver_declined: 'Declined', expired: 'Expired',
  on_my_way_to_pickup: 'On my way to pickup', on_site_pickup: 'On site pickup',
  on_my_way_to_delivery: 'On my way to delivery', on_site_delivery: 'On site delivery',
};

function normalizeCompany(value: CompanyRelation) {
  return !value ? null : Array.isArray(value) ? (value[0] ?? null) : value;
}

function fmtDate(value: string | null) {
  if (!value) return 'â€”';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'â€”' : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function withinHours(value: string | null, window: TimeWindow) {
  if (window === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return !Number.isNaN(timestamp) && timestamp >= Date.now() && timestamp <= Date.now() + Number(window) * 60 * 60 * 1000;
}

function withinDateRange(value: string | null, range: DateRange) {
  if (range === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const now = new Date();
  if (range === 'today') {
    const target = new Date(value);
    return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
  }
  return timestamp >= Date.now() - (range === '7d' ? 7 : 30) * 86400000;
}

function groupByJobId<T extends { job_id: string | null }>(rows: T[]) {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) {
    if (!row.job_id) continue;
    (grouped[row.job_id] ??= []).push(row);
  }
  return grouped;
}

function isDerivedExpired(job: HistoryJob) {
  if (job.status === 'expired') return true;
  if (!['posted', 'quoted', 'awarded'].includes(job.status)) return false;
  const target = job.deadline_at ?? job.pickup_datetime ?? job.collection_window_start;
  if (!target) return false;
  const timestamp = new Date(target).getTime();
  return !Number.isNaN(timestamp) && timestamp < Date.now();
}

function hasRecentFeedback(job: HistoryJob, reviews: ReviewRow[]) {
  if (reviews.length > 0) return true;
  return ['received', 'completed', 'submitted', 'left', 'recent'].includes((job.feedback_status ?? '').toLowerCase());
}

function isAwaitingFeedback(job: HistoryJob, reviews: ReviewRow[]) {
  return COMPLETED_STATUSES.has(job.status) && !hasRecentFeedback(job, reviews);
}

function filterMatches(job: HistoryJob, filter: HistoryFilter, reviews: ReviewRow[]) {
  if (filter === 'all') return true;
  if (filter === 'unallocated') return !job.assigned_driver_id;
  if (filter === 'allocated') return ALLOCATED_STATUSES.has(job.status);
  if (filter === 'in_progress') return IN_PROGRESS_STATUSES.has(job.status);
  if (filter === 'completed') return COMPLETED_STATUSES.has(job.status);
  if (filter === 'cancelled') return CANCELLED_STATUSES.has(job.status);
  if (filter === 'expired') return isDerivedExpired(job);
  if (filter === 'awaiting_feedback') return isAwaitingFeedback(job, reviews);
  return hasRecentFeedback(job, reviews);
}

function statusTone(status: string): 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'grey' {
  if (COMPLETED_STATUSES.has(status)) return 'green';
  if (CANCELLED_STATUSES.has(status)) return 'red';
  if (status === 'disputed') return 'purple';
  if (status === 'expired') return 'grey';
  if (ALLOCATED_STATUSES.has(status) || IN_PROGRESS_STATUSES.has(status)) return 'blue';
  return 'orange';
}

export default function JobHistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [reviewsByJob, setReviewsByJob] = useState<Record<string, ReviewRow[]>>({});
  const [invoicesByJob, setInvoicesByJob] = useState<Record<string, InvoiceRow>>({});
  const [documentsByJob, setDocumentsByJob] = useState<Record<string, DocumentRow[]>>({});
  const [eventsByJob, setEventsByJob] = useState<Record<string, TrackingEventRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailWarning, setDetailWarning] = useState('');
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>('all');
  const [search, setSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [detailTabs, setDetailTabs] = useState<Record<string, DetailTab>>({});

  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || authLoading) return;
    if (!driverId) { setLoading(false); return; }

    setLoading(true);
    setError('');
    setDetailWarning('');

    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, status, assigned_driver_id, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, collection_window_start, delivery_window_start, deadline_at, budget_amount, vehicle_type, cargo_type, load_details, load_notes, collection_notes, delivery_notes, driver_notes, hard_copy_pod, pod_required, pod_generated, pod_generated_at, pod_photos, delivery_photos, status_history, feedback_status, broker_pod_review_status, broker_pod_review_note, updated_at, created_at, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)')
      .eq('assigned_driver_id', driverId)
      .order('updated_at', { ascending: false })
      .limit(250);

    if (fetchError) {
      setError('Diary records could not be loaded. Please refresh and try again.');
      setJobs([]);
      setLoading(false);
      return;
    }

    const normalized = ((data ?? []) as unknown as Array<Omit<HistoryJob, 'companies'> & { companies: CompanyRelation }>).map((job) => ({
      ...job,
      companies: normalizeCompany(job.companies),
    }));
    setJobs(normalized);

    const jobIds = normalized.map((job) => job.id);
    if (!jobIds.length) {
      setReviewsByJob({});
      setInvoicesByJob({});
      setDocumentsByJob({});
      setEventsByJob({});
      setLoading(false);
      return;
    }

    const [reviewsRes, invoicesRes, documentsRes, eventsRes] = await Promise.all([
      supabase.from('reviews').select('id, job_id, rating, comment, created_at').in('job_id', jobIds).order('created_at', { ascending: false }),
      supabase.from('invoices').select('id, job_id, invoice_number, status, payment_status, total, amount, due_date, created_at').in('job_id', jobIds).order('created_at', { ascending: false }),
      supabase.from('job_documents').select('id, job_id, file_name, file_type, file_url, uploaded_at').in('job_id', jobIds).order('uploaded_at', { ascending: false }),
      supabase.from('job_tracking_events').select('id, job_id, event_type, event_time, user_name, notes, message').in('job_id', jobIds).order('event_time', { ascending: false }),
    ]);

    const warnings: string[] = [];
    if (reviewsRes.error) warnings.push('feedback');
    else setReviewsByJob(groupByJobId((reviewsRes.data ?? []) as ReviewRow[]));

    if (documentsRes.error) warnings.push('documents');
    else setDocumentsByJob(groupByJobId((documentsRes.data ?? []) as DocumentRow[]));

    if (eventsRes.error) warnings.push('history');
    else setEventsByJob(groupByJobId((eventsRes.data ?? []) as TrackingEventRow[]));

    if (invoicesRes.error) warnings.push('invoice');
    else {
      const invoiceMap: Record<string, InvoiceRow> = {};
      for (const invoice of (invoicesRes.data ?? []) as InvoiceRow[]) {
        if (invoice.job_id && !invoiceMap[invoice.job_id]) invoiceMap[invoice.job_id] = invoice;
      }
      setInvoicesByJob(invoiceMap);
    }

    if (warnings.length) setDetailWarning(`Some Diary detail data is temporarily unavailable: ${warnings.join(', ')}.`);
    setLoading(false);
  }, [authLoading, driverId]);

  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  const searchedJobs = useMemo(() => jobs.filter((job) => {
    const refDate = job.pickup_datetime ?? job.collection_window_start ?? job.updated_at ?? job.created_at;
    if (!withinDateRange(refDate, appliedSearch.dateRange)) return false;
    if (!withinHours(job.pickup_datetime ?? job.collection_window_start, appliedSearch.pickupWithin)) return false;
    if (!withinHours(job.delivery_datetime ?? job.delivery_window_start, appliedSearch.deliveryWithin)) return false;
    const refNeedle = appliedSearch.loadRef.trim().toLowerCase();
    const memberNeedle = appliedSearch.memberName.trim().toLowerCase();
    if (refNeedle && ![job.id, job.customer_reference, job.booking_reference].filter(Boolean).join(' ').toLowerCase().includes(refNeedle)) return false;
    if (memberNeedle && !(job.companies?.name ?? '').toLowerCase().includes(memberNeedle)) return false;
    return true;
  }), [appliedSearch, jobs]);

  const visibleFiltered = useMemo(
    () => searchedJobs.filter((job) => filterMatches(job, statusFilter, reviewsByJob[job.id] ?? [])),
    [reviewsByJob, searchedJobs, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(visibleFiltered.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleJobs = visibleFiltered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  useEffect(() => { setPage(1); }, [statusFilter, appliedSearch, itemsPerPage]);

  const allExpanded = visibleJobs.length > 0 && visibleJobs.every((job) => expandedIds.has(job.id));
  const toggleExpandAll = () => setExpandedIds((previous) => {
    const next = new Set(previous);
    visibleJobs.forEach((job) => allExpanded ? next.delete(job.id) : next.add(job.id));
    return next;
  });

  const filterRail = (
    <aside className="driver-filter-rail" aria-label="Diary search filters">
      <div className="driver-filter-rail__header">Search Diary</div>
      <div className="driver-filter-rail__body">
        <div className="driver-filter-field">
          <label>Date</label>
          <select value={search.dateRange} onChange={(e) => setSearch((current) => ({ ...current, dateRange: e.target.value as DateRange }))}>
            <option value="any">Anytime</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        <div className="driver-filter-field">
          <label>Pickup Time Within</label>
          <select value={search.pickupWithin} onChange={(e) => setSearch((current) => ({ ...current, pickupWithin: e.target.value as TimeWindow }))}>
            {TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="driver-filter-field">
          <label>Delivery Time Within</label>
          <select value={search.deliveryWithin} onChange={(e) => setSearch((current) => ({ ...current, deliveryWithin: e.target.value as TimeWindow }))}>
            {TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="driver-filter-field">
          <label>Load ID / Ref</label>
          <input value={search.loadRef} onChange={(e) => setSearch((current) => ({ ...current, loadRef: e.target.value }))} placeholder="Job, booking or ref" />
        </div>
        <div className="driver-filter-field">
          <label>Member / Customer</label>
          <input value={search.memberName} onChange={(e) => setSearch((current) => ({ ...current, memberName: e.target.value }))} placeholder="Company name" />
        </div>
        <div className="driver-filter-actions">
          <ActionButton tone="success" onClick={() => setAppliedSearch(search)}>Search</ActionButton>
          <ActionButton tone="secondary" onClick={() => { setSearch(EMPTY_SEARCH); setAppliedSearch(EMPTY_SEARCH); }}>Clear</ActionButton>
        </div>
        <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Payment Report</ActionButton>
      </div>
    </aside>
  );

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="Search, scan and expand every booking from one operational diary."
        headerActions={<ActionButton tone="primary" onClick={() => void fetchHistory()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {detailWarning && <AlertBanner tone="warning">{detailWarning}</AlertBanner>}

        <div className="driver-board-layout driver-diary-board">
          {filterRail}
          <main className="driver-board-main">
            <div className="driver-tab-strip driver-diary-status-strip" role="tablist" aria-label="Diary states">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-active={statusFilter === item.id ? 'true' : 'false'}
                  onClick={() => setStatusFilter(item.id)}
                >
                  {item.label} <span>{searchedJobs.filter((job) => filterMatches(job, item.id, reviewsByJob[job.id] ?? [])).length}</span>
                </button>
              ))}
            </div>

            <div className="driver-board-summary">
              <span>{visibleFiltered.length} booking{visibleFiltered.length === 1 ? '' : 's'} Â· showing {visibleJobs.length}</span>
              <span className="driver-diary-summary-actions">
                <button type="button" onClick={toggleExpandAll} disabled={!visibleJobs.length}>{allExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button>
                <label>
                  Items per Page:
                  <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </span>
            </div>

            {loading ? (
              <div className="driver-load-row"><EmptyState compact title="Loading diaryâ€¦" /></div>
            ) : visibleJobs.length === 0 ? (
              <div className="driver-load-row"><EmptyState compact title="No bookings in this view" description="Adjust the status or search filters." /></div>
            ) : (
              <div className="driver-load-list">
                {visibleJobs.map((job) => {
                  const expanded = expandedIds.has(job.id);
                  const reviews = reviewsByJob[job.id] ?? [];
                  const invoice = invoicesByJob[job.id];
                  const documents = documentsByJob[job.id] ?? [];
                  const trackingEvents = eventsByJob[job.id] ?? [];
                  const detailTab = detailTabs[job.id] ?? 'order';
                  const podPhotos = Array.isArray(job.pod_photos) ? job.pod_photos : (Array.isArray(job.delivery_photos) ? job.delivery_photos : []);
                  const hasPod = Boolean(job.pod_generated || podPhotos.length > 0);
                  const feedbackReceived = hasRecentFeedback(job, reviews);
                  const awaitingFeedback = isAwaitingFeedback(job, reviews);
                  const expired = isDerivedExpired(job);
                  const historyRows = [
                    ...(Array.isArray(job.status_history) ? job.status_history.map((entry, index) => ({
                      key: `status-${index}`,
                      label: STATUS_LABELS[entry.status ?? ''] ?? entry.status ?? 'Status update',
                      at: entry.timestamp ?? entry.at ?? null,
                      detail: 'Job status history',
                    })) : []),
                    ...trackingEvents.map((event) => ({
                      key: event.id,
                      label: event.event_type ? (STATUS_LABELS[event.event_type] ?? event.event_type.replace(/_/g, ' ')) : 'Tracking event',
                      at: event.event_time,
                      detail: event.message ?? event.notes ?? event.user_name ?? 'Operational event',
                    })),
                  ].sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime());
                  const noteRows = [
                    ['Load notes', job.load_notes ?? job.load_details],
                    ['Collection notes', job.collection_notes],
                    ['Delivery notes', job.delivery_notes],
                    ['Driver notes', job.driver_notes],
                    ['POD review note', job.broker_pod_review_note],
                  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

                  return (
                    <article key={job.id} className="driver-load-row driver-diary-entry" data-state={expired ? 'expired' : job.status}>
                      <div className="driver-load-row__top driver-diary-entry__top">
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">From</span>
                          <strong className="driver-cell-primary">{job.pickup_location ?? 'Collection'}</strong>
                          <span className="driver-cell-secondary">{job.pickup_postcode ?? 'â€”'}</span>
                        </div>
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">To</span>
                          <strong className="driver-cell-primary">{job.delivery_location ?? 'Delivery'}</strong>
                          <span className="driver-cell-secondary">{job.delivery_postcode ?? 'â€”'}</span>
                        </div>
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">Timing / Load</span>
                          <strong className="driver-cell-primary">Pickup {fmtDate(job.pickup_datetime ?? job.collection_window_start)}</strong>
                          <span className="driver-cell-secondary">Deliver {fmtDate(job.delivery_datetime ?? job.delivery_window_start)} Â· {job.vehicle_type?.replace(/_/g, ' ') ?? 'Vehicle TBC'}</span>
                        </div>
                        <div className="driver-load-cell">
                          <span className="driver-cell-label">Status / Commercial</span>
                          <strong className="driver-cell-primary">{expired ? 'Expired' : (STATUS_LABELS[job.status] ?? job.status)}</strong>
                          <span className="driver-cell-secondary">{job.companies?.name ?? 'Member not supplied'} Â· {job.budget_amount != null ? money(job.budget_amount) : 'Rate TBC'}</span>
                        </div>
                      </div>

                      <div className="driver-load-row__meta">
                        <span>Load #{job.id.slice(0, 8).toUpperCase()}</span>
                        {job.booking_reference && <span>Booking: {job.booking_reference}</span>}
                        {job.customer_reference && <span>Customer ref: {job.customer_reference}</span>}
                        <StatusBadge value={expired ? 'Expired' : (STATUS_LABELS[job.status] ?? job.status)} tone={expired ? 'grey' : statusTone(job.status)} />
                        {hasPod && <StatusBadge value="POD captured" tone="green" />}
                        {awaitingFeedback && <StatusBadge value="Awaiting feedback" tone="orange" />}
                        {feedbackReceived && <StatusBadge value="Feedback received" tone="green" />}
                        <div className="driver-row-actions">
                          <ActionButton tone="secondary" onClick={() => setExpandedIds((previous) => {
                            const next = new Set(previous);
                            if (next.has(job.id)) { next.delete(job.id); } else { next.add(job.id); }
                            return next;
                          })}>{expanded ? 'Collapse' : 'Details'}</ActionButton>
                          <ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open job</ActionButton>
                        </div>
                      </div>

                      {expanded && (
                        <div className="driver-row-details driver-diary-details">
                          <div className="driver-diary-detail-tabs" role="tablist" aria-label={`Booking ${job.id} details`}>
                            {DETAIL_TABS.map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                data-active={detailTab === tab.id ? 'true' : 'false'}
                                onClick={() => setDetailTabs((current) => ({ ...current, [job.id]: tab.id }))}
                              >
                                {tab.label}
                                {tab.id === 'documents' && documents.length > 0 ? ` ${documents.length}` : ''}
                              </button>
                            ))}
                          </div>

                          <div className="driver-diary-detail-panel">
                            {detailTab === 'order' && (
                              <>
                                <div className="driver-detail-grid">
                                  <div className="driver-detail-item"><span>Booked by</span><strong>{job.companies?.name ?? 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Agreed rate</span><strong>{job.budget_amount != null ? money(job.budget_amount) : 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Booking ref</span><strong>{job.booking_reference ?? 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Customer ref</span><strong>{job.customer_reference ?? 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Vehicle</span><strong>{job.vehicle_type?.replace(/_/g, ' ') ?? 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Freight</span><strong>{job.cargo_type?.replace(/_/g, ' ') ?? 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Hard copy POD</span><strong>{job.hard_copy_pod ?? (job.pod_required ? 'Required' : 'Not required')}</strong></div>
                                  <div className="driver-detail-item"><span>Route</span><strong>{job.pickup_postcode ?? 'â€”'} â†’ {job.delivery_postcode ?? 'â€”'}</strong></div>
                                </div>
                                {(job.load_notes || job.load_details) && <div className="driver-diary-text-block"><strong>Load notes</strong><span>{job.load_notes ?? job.load_details}</span></div>}
                              </>
                            )}

                            {detailTab === 'pod' && (
                              <div className="driver-detail-grid">
                                <div className="driver-detail-item"><span>POD required</span><strong>{job.pod_required ? 'Yes' : 'No'}</strong></div>
                                <div className="driver-detail-item"><span>POD status</span><strong>{hasPod ? 'Captured' : 'Pending'}</strong></div>
                                <div className="driver-detail-item"><span>Photos</span><strong>{podPhotos.length}</strong></div>
                                <div className="driver-detail-item"><span>Generated</span><strong>{job.pod_generated_at ? fmtDate(job.pod_generated_at) : 'â€”'}</strong></div>
                                <div className="driver-detail-item"><span>Broker review</span><strong>{job.broker_pod_review_status?.replace(/_/g, ' ') ?? 'Not reviewed'}</strong></div>
                                <div className="driver-detail-item driver-diary-detail-action"><span>Execution record</span><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open POD / job</ActionButton></div>
                              </div>
                            )}

                            {detailTab === 'notes' && (
                              noteRows.length ? (
                                <div className="driver-diary-note-list">
                                  {noteRows.map(([label, value]) => <div key={label} className="driver-diary-text-block"><strong>{label}</strong><span>{value}</span></div>)}
                                </div>
                              ) : <EmptyState compact title="No notes recorded" />
                            )}

                            {detailTab === 'history' && (
                              historyRows.length ? (
                                <div className="driver-diary-history-list">
                                  {historyRows.slice(0, 30).map((row) => (
                                    <div key={row.key} className="driver-diary-history-row">
                                      <strong>{row.label}</strong>
                                      <span>{fmtDate(row.at)}</span>
                                      <span>{row.detail}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <EmptyState compact title="No history events recorded" />
                            )}

                            {detailTab === 'documents' && (
                              documents.length ? (
                                <div className="driver-diary-document-list">
                                  {documents.map((document) => (
                                    <div key={document.id} className="driver-diary-document-row">
                                      <span><strong>{document.file_name ?? document.file_type ?? 'Document'}</strong><small>{document.file_type ?? 'File'} Â· {fmtDate(document.uploaded_at)}</small></span>
                                      {document.file_url && <button type="button" onClick={() => window.open(document.file_url ?? '', '_blank', 'noopener,noreferrer')}>Open</button>}
                                    </div>
                                  ))}
                                </div>
                              ) : <EmptyState compact title="No documents attached" />
                            )}

                            {detailTab === 'invoice' && (
                              invoice ? (
                                <div className="driver-detail-grid">
                                  <div className="driver-detail-item"><span>Invoice</span><strong>{invoice.invoice_number ?? invoice.id.slice(0, 8).toUpperCase()}</strong></div>
                                  <div className="driver-detail-item"><span>Amount</span><strong>{money(Number(invoice.total ?? invoice.amount ?? 0))}</strong></div>
                                  <div className="driver-detail-item"><span>Status</span><strong>{invoice.status ?? 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Payment</span><strong>{invoice.payment_status ?? 'â€”'}</strong></div>
                                  <div className="driver-detail-item"><span>Due</span><strong>{invoice.due_date ? fmtDate(invoice.due_date) : 'â€”'}</strong></div>
                                  <div className="driver-detail-item driver-diary-detail-action"><span>Invoice record</span><ActionButton tone="secondary" onClick={() => router.push(`/driver/finance/invoices/${invoice.id}`)}>View invoice (Â£)</ActionButton></div>
                                </div>
                              ) : (
                                <div className="driver-diary-empty-action"><EmptyState compact title="No invoice generated for this booking" /><ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Open Finance</ActionButton></div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {visibleFiltered.length > itemsPerPage && (
              <div className="driver-board-summary driver-diary-pagination">
                <ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton>
                <span>Page {safePage} / {totalPages}</span>
                <ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton>
              </div>
            )}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
