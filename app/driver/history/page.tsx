'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  KpiCard,
  KpiGrid,
  Panel,
  StatusBadge,
} from '../../components/workspace/WorkspaceUI';

type CompanyRelation = { name: string } | Array<{ name: string }> | null;
type TimeWindow = 'any' | '2' | '4' | '8' | '24';
type DateRange = 'any' | 'today' | '7d' | '30d';

type HistoryJob = {
  id: string;
  status: string;
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
  updated_at: string | null;
  created_at: string | null;
  delivery_photos: string[] | null;
  customer_reference: string | null;
  booking_reference: string | null;
  companies: { name: string } | null;
};

type HistoryFilter = 'all' | 'allocated' | 'in_progress' | 'delivered' | 'cancelled' | 'disputed' | 'driver_declined';

type SearchFilters = {
  dateRange: DateRange;
  pickupWithin: TimeWindow;
  deliveryWithin: TimeWindow;
  loadRef: string;
  memberName: string;
};

const EMPTY_SEARCH: SearchFilters = {
  dateRange: 'any',
  pickupWithin: 'any',
  deliveryWithin: 'any',
  loadRef: '',
  memberName: '',
};

const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'delivered', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'driver_declined', label: 'Declined' },
];

const STATUS_LABELS: Record<string, string> = {
  allocated: 'Allocated',
  collected: 'Loaded',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
  driver_declined: 'Declined',
};

const STATUS_TONES: Record<string, 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'navy'> = {
  allocated: 'blue',
  collected: 'navy',
  in_transit: 'navy',
  delivered: 'green',
  cancelled: 'red',
  disputed: 'purple',
  driver_declined: 'orange',
};

const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: '2', label: '2 hours' },
  { value: '4', label: '4 hours' },
  { value: '8', label: '8 hours' },
  { value: '24', label: '24 hours' },
];

const fieldStyle: CSSProperties = { display: 'grid', gap: '4px', minWidth: '150px' };
const labelStyle: CSSProperties = { color: '#64748b', fontSize: '10px', fontWeight: 700 };
const inputStyle: CSSProperties = { height: '36px', border: '1px solid #d8dee8', borderRadius: '4px', background: '#fff', color: '#172033', padding: '0 10px', fontSize: '12px' };

function normalizeCompany(value: CompanyRelation) {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function fmtDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function withinHours(value: string | null, window: TimeWindow) {
  if (window === 'any') return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const now = Date.now();
  return timestamp >= now && timestamp <= now + Number(window) * 60 * 60 * 1000;
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
  const days = range === '7d' ? 7 : 30;
  const earliest = Date.now() - days * 24 * 60 * 60 * 1000;
  return timestamp >= earliest;
}

function filterMatches(job: HistoryJob, filter: HistoryFilter) {
  if (filter === 'all') return true;
  if (filter === 'in_progress') return ['collected', 'in_transit'].includes(job.status);
  return job.status === filter;
}

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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchHistory = useCallback(async () => {
    if (!isSupabaseConfigured || authLoading) return;
    if (!driverId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('jobs')
      .select('id, status, pickup_location, pickup_postcode, delivery_location, delivery_postcode, pickup_datetime, delivery_datetime, collection_window_start, delivery_window_start, deadline_at, budget_amount, updated_at, created_at, delivery_photos, customer_reference, booking_reference, companies:companies!jobs_company_id_fkey(name)')
      .eq('assigned_driver_id', driverId)
      .in('status', ['allocated', 'collected', 'in_transit', 'delivered', 'cancelled', 'disputed', 'driver_declined'])
      .order('updated_at', { ascending: false })
      .limit(250);

    if (fetchError) {
      setError('Diary records could not be loaded. Please refresh and try again.');
      setJobs([]);
    } else {
      const normalized = ((data ?? []) as unknown as Array<Omit<HistoryJob, 'companies'> & { companies: CompanyRelation }>).map((job) => ({
        ...job,
        companies: normalizeCompany(job.companies),
      }));
      setJobs(normalized);
    }
    setLoading(false);
  }, [authLoading, driverId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const deliveredJobs = useMemo(() => jobs.filter((job) => job.status === 'delivered'), [jobs]);
  const totalEarned = useMemo(() => deliveredJobs.reduce((sum, job) => sum + Number(job.budget_amount ?? 0), 0), [deliveredJobs]);
  const withPod = useMemo(() => deliveredJobs.filter((job) => Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0).length, [deliveredJobs]);

  const searchedJobs = useMemo(() => {
    const refNeedle = appliedSearch.loadRef.trim().toLowerCase();
    const memberNeedle = appliedSearch.memberName.trim().toLowerCase();
    return jobs.filter((job) => {
      const referenceDate = job.pickup_datetime ?? job.collection_window_start ?? job.updated_at ?? job.created_at;
      if (!withinDateRange(referenceDate, appliedSearch.dateRange)) return false;
      if (!withinHours(job.pickup_datetime ?? job.collection_window_start, appliedSearch.pickupWithin)) return false;
      if (!withinHours(job.delivery_datetime ?? job.delivery_window_start, appliedSearch.deliveryWithin)) return false;

      if (refNeedle) {
        const haystack = [job.id, job.customer_reference, job.booking_reference].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(refNeedle)) return false;
      }
      if (memberNeedle) {
        const haystack = `${job.companies?.name ?? ''}`.toLowerCase();
        if (!haystack.includes(memberNeedle)) return false;
      }
      return true;
    });
  }, [appliedSearch, jobs]);

  const visibleFiltered = useMemo(() => searchedJobs.filter((job) => filterMatches(job, statusFilter)), [searchedJobs, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleFiltered.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const visibleJobs = visibleFiltered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, appliedSearch, itemsPerPage]);

  const allExpanded = visibleJobs.length > 0 && visibleJobs.every((job) => expandedIds.has(job.id));
  const toggleExpandAll = () => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (allExpanded) visibleJobs.forEach((job) => next.delete(job.id));
      else visibleJobs.forEach((job) => next.add(job.id));
      return next;
    });
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        subtitle="All allocated, in-progress and closed bookings in one searchable operational diary."
        headerActions={<ActionButton tone="primary" onClick={() => void fetchHistory()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}

        <KpiGrid>
          <KpiCard label="Delivered" value={deliveredJobs.length} detail="Completed jobs" tone="green" />
          <KpiCard label="Recorded earnings" value={money(totalEarned)} detail="Delivered job values" tone="blue" />
          <KpiCard label="POD captured" value={withPod} detail={`${deliveredJobs.length ? Math.round((withPod / deliveredJobs.length) * 100) : 0}% of delivered`} tone="navy" />
          <KpiCard label="Allocated" value={jobs.filter((job) => job.status === 'allocated').length} detail="Awaiting execution" tone="blue" />
          <KpiCard label="In progress" value={jobs.filter((job) => ['collected', 'in_transit'].includes(job.status)).length} detail="Current execution" tone="orange" />
          <KpiCard label="All diary" value={jobs.length} detail="Assigned work records" tone="purple" />
        </KpiGrid>

        <Panel title="Search Panel" flush>
          <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', alignItems: 'end' }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Date</span>
              <select style={inputStyle} value={search.dateRange} onChange={(event) => setSearch((current) => ({ ...current, dateRange: event.target.value as DateRange }))}>
                <option value="any">Anytime</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Pickup Time Within</span>
              <select style={inputStyle} value={search.pickupWithin} onChange={(event) => setSearch((current) => ({ ...current, pickupWithin: event.target.value as TimeWindow }))}>
                {TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Delivery Time Within</span>
              <select style={inputStyle} value={search.deliveryWithin} onChange={(event) => setSearch((current) => ({ ...current, deliveryWithin: event.target.value as TimeWindow }))}>
                {TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Load ID / Ref</span>
              <input style={inputStyle} value={search.loadRef} onChange={(event) => setSearch((current) => ({ ...current, loadRef: event.target.value }))} placeholder="Job, booking or customer ref" />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Member / Customer Name</span>
              <input style={inputStyle} value={search.memberName} onChange={(event) => setSearch((current) => ({ ...current, memberName: event.target.value }))} placeholder="Company name" />
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <ActionButton tone="success" onClick={() => setAppliedSearch(search)}>Search</ActionButton>
              <ActionButton tone="secondary" onClick={() => { setSearch(EMPTY_SEARCH); setAppliedSearch(EMPTY_SEARCH); }}>Clear</ActionButton>
              <ActionButton tone="secondary" onClick={() => router.push('/driver/finance')}>Payment Report</ActionButton>
            </div>
          </div>
        </Panel>

        <div className="driver-status-tabs" aria-label="Diary filters">
          {FILTERS.map((item) => (
            <button key={item.id} type="button" data-active={statusFilter === item.id} onClick={() => setStatusFilter(item.id)}>
              {item.label} {searchedJobs.filter((job) => filterMatches(job, item.id)).length}
            </button>
          ))}
        </div>

        <Panel
          title="Diary"
          description="Open or expand a booking for POD, notes, documents, invoice and execution history."
          actions={(
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={toggleExpandAll} disabled={visibleJobs.length === 0} style={{ border: 0, background: 'transparent', color: visibleJobs.length ? '#1d57d8' : '#94a3b8', fontWeight: 700, cursor: visibleJobs.length ? 'pointer' : 'default' }}>{allExpanded ? 'Collapse All Entries' : 'Expand All Entries'}</button>
              <select aria-label="Items per page" style={{ ...inputStyle, width: '78px' }} value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          )}
          flush
        >
          {loading ? (
            <div style={{ padding: '20px' }}><EmptyState title="Loading diary" /></div>
          ) : visibleJobs.length === 0 ? (
            <div style={{ padding: '20px' }}><EmptyState title="No bookings in this view" description="Adjust the status or search filters to see more diary records." /></div>
          ) : (
            <div className="driver-ops-table-wrap">
              <table className="driver-ops-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Route</th>
                    <th>Pickup</th>
                    <th>Delivery / Closed</th>
                    <th>Value</th>
                    <th>POD</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => {
                    const hasPod = Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0;
                    const jobDate = job.delivery_datetime ?? job.updated_at ?? job.deadline_at ?? job.delivery_window_start ?? job.created_at;
                    const expanded = expandedIds.has(job.id);
                    return (
                      <FragmentRow
                        key={job.id}
                        job={job}
                        hasPod={hasPod}
                        expanded={expanded}
                        jobDate={jobDate}
                        onToggle={() => setExpandedIds((previous) => {
                          const next = new Set(previous);
                          if (next.has(job.id)) next.delete(job.id); else next.add(job.id);
                          return next;
                        })}
                        onOpen={() => router.push(`/driver/jobs/${job.id}`)}
                        onDocuments={() => router.push('/driver/documents')}
                        onInvoice={() => router.push('/driver/finance')}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {visibleFiltered.length > itemsPerPage && (
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

function FragmentRow({
  job,
  hasPod,
  expanded,
  jobDate,
  onToggle,
  onOpen,
  onDocuments,
  onInvoice,
}: {
  job: HistoryJob;
  hasPod: boolean;
  expanded: boolean;
  jobDate: string | null;
  onToggle: () => void;
  onOpen: () => void;
  onDocuments: () => void;
  onInvoice: () => void;
}) {
  return (
    <>
      <tr>
        <td><strong>#{job.id.slice(0, 8).toUpperCase()}</strong></td>
        <td><strong>{job.pickup_location ?? 'Collection'} → {job.delivery_location ?? 'Delivery'}</strong></td>
        <td>{fmtDate(job.pickup_datetime ?? job.collection_window_start)}</td>
        <td>{fmtDate(jobDate)}</td>
        <td>{job.budget_amount != null ? money(job.budget_amount) : '—'}</td>
        <td>{hasPod ? <StatusBadge value="Captured" tone="green" /> : <span style={{ color: '#64748b' }}>—</span>}</td>
        <td><StatusBadge value={STATUS_LABELS[job.status] ?? job.status} tone={STATUS_TONES[job.status]} /></td>
        <td><ActionButton tone="secondary" onClick={onToggle}>{expanded ? 'Collapse' : 'Open'}</ActionButton></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ background: '#f8fafc' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                <div><strong>Booked by</strong><br />{job.companies?.name ?? '—'}</div>
                <div><strong>Customer ref</strong><br />{job.customer_reference ?? '—'}</div>
                <div><strong>Booking ref</strong><br />{job.booking_reference ?? '—'}</div>
                <div><strong>Route postcodes</strong><br />{job.pickup_postcode ?? '—'} → {job.delivery_postcode ?? '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <ActionButton tone="secondary" onClick={onOpen}>POD</ActionButton>
                <ActionButton tone="secondary" onClick={onOpen}>Order</ActionButton>
                <ActionButton tone="secondary" onClick={onOpen}>Notes</ActionButton>
                <ActionButton tone="secondary" onClick={onOpen}>History</ActionButton>
                <ActionButton tone="secondary" onClick={onDocuments}>Documents</ActionButton>
                {job.status === 'delivered' && <ActionButton tone="secondary" onClick={onInvoice}>View invoice (£)</ActionButton>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
