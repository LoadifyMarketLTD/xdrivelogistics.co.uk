'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { resolveActiveCompanyId } from '../../../lib/activeCompany';
import { classifyWorkspaceJobStage, workspaceJobPresentationStatus } from '../../../lib/jobs/workspaceJobStage';
import { supabase } from '../../../lib/supabaseClient';
import { CompanyJobSheetPanel } from './CompanyJobSheetPanel';
import {
  ActionButton,
  AlertBanner,
  EmptyState,
  PageFrame,
  PageHeader,
  StatusBadge,
} from './WorkspaceUI';

type DiaryTab = 'all' | 'unallocated' | 'allocated' | 'in_progress' | 'completed' | 'cancelled' | 'expired' | 'evidence';
type JobRow = {
  id: string;
  company_id: string | null;
  assigned_company_id: string | null;
  awarded_carrier_company_id: string | null;
  assigned_driver_id: string | null;
  status: string;
  current_status: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  client_name: string | null;
  customer_reference: string | null;
  booking_reference: string | null;
  pod_generated: boolean | null;
  pod_generated_at: string | null;
  delivery_photos: string[] | null;
  updated_at: string | null;
  created_at: string | null;
};

type DriverRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  status: string | null;
  availability_status: string | null;
};

type SearchState = {
  from: string;
  to: string;
  reference: string;
  customer: string;
  driver: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_SEARCH: SearchState = { from: '', to: '', reference: '', customer: '', driver: '', dateFrom: '', dateTo: '' };
const TABS: Array<{ id: DiaryTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unallocated', label: 'Unallocated' },
  { id: 'allocated', label: 'Allocated' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
  { id: 'evidence', label: 'POD / Evidence' },
];

const normalise = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase();
const when = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not set';

// Client-side account-state filter only. Full driver + canonical vehicle
// operational eligibility is revalidated by the authorised allocation endpoint.
const isActiveDriverAccount = (driver: DriverRow) => normalise(driver.status) === 'active';

function effectiveStatus(job: JobRow) {
  return workspaceJobPresentationStatus(job);
}

function isOperatingCompanyJob(job: JobRow, companyId: string) {
  if (job.awarded_carrier_company_id) return job.awarded_carrier_company_id === companyId;
  if (job.assigned_company_id) return job.assigned_company_id === companyId;
  if (job.company_id !== companyId) return false;
  const stage = classifyWorkspaceJobStage(job);
  // A company can execute its own transport when no separate carrier is
  // awarded, but draft/posted/quoted customer-marketplace records are not an
  // operational Diary merely because company_id matches.
  return Boolean(job.assigned_driver_id) || !['open', 'draft'].includes(stage);
}

function matchesTab(job: JobRow, tab: DiaryTab) {
  if (tab === 'all') return true;
  const stage = classifyWorkspaceJobStage(job);
  if (tab === 'unallocated') return (stage === 'awarded' || stage === 'allocated') && !job.assigned_driver_id;
  if (tab === 'allocated') return (stage === 'awarded' || stage === 'allocated') && Boolean(job.assigned_driver_id);
  if (tab === 'in_progress') return stage === 'in_progress';
  if (tab === 'completed') return stage === 'completed';
  if (tab === 'cancelled') return stage === 'cancelled' || stage === 'disputed';
  if (tab === 'expired') return stage === 'expired';
  return stage === 'completed' && (job.pod_generated === true || (job.delivery_photos?.length ?? 0) > 0);
}

function stageTone(job: JobRow): 'green' | 'blue' | 'orange' | 'red' | 'grey' | 'purple' {
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'completed') return 'green';
  if (stage === 'in_progress') return 'orange';
  if (stage === 'awarded' || stage === 'allocated') return 'blue';
  if (stage === 'disputed') return 'purple';
  if (stage === 'cancelled' || stage === 'expired') return 'red';
  return 'grey';
}

export default function OperationsDiaryPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const companyId = resolveActiveCompanyId(user);
  const deepJob = searchParams.get('job');
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<DiaryTab>('all');
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [appliedSearch, setAppliedSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(deepJob ? [deepJob] : []));
  const [assigning, setAssigning] = useState<string | null>(null);
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    if (!companyId) { setJobs([]); setDrivers([]); setLoading(false); return; }
    setLoading(true); setError('');
    const [jobsResult, driversResult] = await Promise.all([
      supabase
        .from('jobs')
        .select('id, company_id, assigned_company_id, awarded_carrier_company_id, assigned_driver_id, status, current_status, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, vehicle_type, client_name, customer_reference, booking_reference, pod_generated, pod_generated_at, delivery_photos, updated_at, created_at')
        .or(`company_id.eq.${companyId},assigned_company_id.eq.${companyId},awarded_carrier_company_id.eq.${companyId}`)
        .order('pickup_datetime', { ascending: true })
        .limit(300),
      supabase
        .from('drivers')
        .select('id, display_name, email, status, availability_status')
        .eq('company_id', companyId)
        .order('display_name', { ascending: true }),
    ]);

    if (jobsResult.error) {
      setError('Diary jobs could not be loaded.');
      setJobs([]);
    } else {
      const scoped = ((jobsResult.data ?? []) as JobRow[]).filter((job) => isOperatingCompanyJob(job, companyId));
      setJobs(scoped);
    }
    if (driversResult.error) {
      setError((current) => current || 'Driver roster could not be loaded.');
      setDrivers([]);
    } else {
      setDrivers((driversResult.data ?? []) as DriverRow[]);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!deepJob) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(deepJob);
      return next;
    });
  }, [deepJob]);

  const activeAccountDrivers = useMemo(() => drivers.filter(isActiveDriverAccount), [drivers]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);

  const filtered = useMemo(() => {
    const from = appliedSearch.from.trim().toLowerCase();
    const to = appliedSearch.to.trim().toLowerCase();
    const reference = appliedSearch.reference.trim().toLowerCase();
    const customer = appliedSearch.customer.trim().toLowerCase();
    const fromDate = appliedSearch.dateFrom ? new Date(`${appliedSearch.dateFrom}T00:00:00`).getTime() : null;
    const toDate = appliedSearch.dateTo ? new Date(`${appliedSearch.dateTo}T23:59:59`).getTime() : null;

    return jobs
      .filter((job) => matchesTab(job, tab))
      .filter((job) => !from || `${job.pickup_location ?? ''} ${job.pickup_postcode ?? ''}`.toLowerCase().includes(from))
      .filter((job) => !to || `${job.delivery_location ?? ''} ${job.delivery_postcode ?? ''}`.toLowerCase().includes(to))
      .filter((job) => !reference || `${job.id} ${job.customer_reference ?? ''} ${job.booking_reference ?? ''}`.toLowerCase().includes(reference))
      .filter((job) => !customer || String(job.client_name ?? '').toLowerCase().includes(customer))
      .filter((job) => !appliedSearch.driver || job.assigned_driver_id === appliedSearch.driver)
      .filter((job) => {
        if (!fromDate && !toDate) return true;
        if (!job.pickup_datetime) return false;
        const timestamp = new Date(job.pickup_datetime).getTime();
        if (Number.isNaN(timestamp)) return false;
        if (fromDate && timestamp < fromDate) return false;
        if (toDate && timestamp > toDate) return false;
        return true;
      });
  }, [appliedSearch, jobs, tab]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((item) => [item.id, jobs.filter((job) => matchesTab(job, item.id)).length])) as Record<DiaryTab, number>, [jobs]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allVisibleExpanded = visible.length > 0 && visible.every((job) => expandedIds.has(job.id));
  useEffect(() => { setPage(1); }, [tab, appliedSearch, pageSize]);

  const toggleExpandAll = () => {
    const shouldExpand = !allVisibleExpanded;
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const job of visible) {
        if (shouldExpand) next.add(job.id);
        else next.delete(job.id);
      }
      return next;
    });
  };

  const toggleJob = (jobId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const assignDriver = async (job: JobRow) => {
    const driverId = driverSelections[job.id];
    if (!driverId) { setError('Choose an active driver account before allocation. Full operational eligibility is verified by the server.'); return; }
    setAssigning(job.id); setError(''); setNotice('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Session expired.');
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(job.id)}/assign-driver`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, expectedDriverId: job.assigned_driver_id ?? null }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Driver allocation failed.');
      setNotice('Driver allocated successfully.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Driver allocation failed.');
    } finally { setAssigning(null); }
  };

  const clearSearch = () => { setSearch(EMPTY_SEARCH); setAppliedSearch(EMPTY_SEARCH); };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Operations"
        title="Diary"
        description="Post-award operating-company register: scan, expand, allocate where authorised and inspect the complete authorised job sheet without leaving the board. Driver execution lifecycle remains in the driver-authorised execution workflow."
        actions={<ActionButton tone="secondary" disabled={loading} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</ActionButton>}
      />
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      <div className="workspace-board-layout">
        <aside className="workspace-filter-rail" aria-label="Diary search filters">
          <div className="workspace-filter-rail__header">Search Diary</div>
          <div className="workspace-filter-rail__body">
            <label>FROM<input value={search.from} onChange={(event) => setSearch((current) => ({ ...current, from: event.target.value }))} placeholder="Pickup town / postcode" /></label>
            <label>TO<input value={search.to} onChange={(event) => setSearch((current) => ({ ...current, to: event.target.value }))} placeholder="Delivery town / postcode" /></label>
            <label>JOB / REF<input value={search.reference} onChange={(event) => setSearch((current) => ({ ...current, reference: event.target.value }))} placeholder="Job, customer or booking ref" /></label>
            <label>CUSTOMER<input value={search.customer} onChange={(event) => setSearch((current) => ({ ...current, customer: event.target.value }))} placeholder="Customer name" /></label>
            <label>DRIVER<select value={search.driver} onChange={(event) => setSearch((current) => ({ ...current, driver: event.target.value }))}><option value="">All drivers</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name ?? driver.email ?? 'Driver'}</option>)}</select></label>
            <label>DATE FROM<input type="date" value={search.dateFrom} onChange={(event) => setSearch((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
            <label>DATE TO<input type="date" value={search.dateTo} onChange={(event) => setSearch((current) => ({ ...current, dateTo: event.target.value }))} /></label>
            <div className="workspace-filter-actions"><ActionButton tone="success" onClick={() => setAppliedSearch(search)}>Search</ActionButton><ActionButton tone="secondary" onClick={clearSearch}>Clear</ActionButton></div>
          </div>
        </aside>

        <main className="workspace-board-main" style={{ minWidth: 0 }}>
          <div className="workspace-tab-strip" role="tablist" aria-label="Diary states" style={{ display: 'flex', overflowX: 'auto', marginBottom: 4 }}>
            {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-active={tab === item.id ? 'true' : 'false'} onClick={() => setTab(item.id)}>{item.label} <span>{counts[item.id]}</span></button>)}
          </div>
          <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}>
            <span>{filtered.length} matching booking{filtered.length === 1 ? '' : 's'} · {visible.length} shown</span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span>Operating-company scope only · post-award execution data</span>
              <button
                type="button"
                onClick={toggleExpandAll}
                disabled={!visible.length}
                aria-label={allVisibleExpanded ? 'Collapse all visible Diary records' : 'Expand all visible Diary records'}
                style={{ minHeight: 24, border: '1px solid var(--ws-border)', borderRadius: 4, background: '#fff', color: '#0B2F6B', padding: '0 8px', fontSize: 11, fontWeight: 600, cursor: visible.length ? 'pointer' : 'not-allowed' }}
              >
                {allVisibleExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </span>
          </div>

          {loading ? (
            <div className="workspace-panel"><EmptyState compact title="Loading Diary…" /></div>
          ) : visible.length === 0 ? (
            <div className="workspace-panel"><EmptyState compact title="No bookings in this view" description="Adjust the status or search filters." /></div>
          ) : (
            <div className="workspace-record-list">
              {visible.map((job) => {
                const open = expandedIds.has(job.id);
                const stage = classifyWorkspaceJobStage(job);
                const status = effectiveStatus(job);
                const driver = job.assigned_driver_id ? driverById.get(job.assigned_driver_id) : undefined;
                const evidenceCount = job.delivery_photos?.length ?? 0;
                return (
                  <article key={job.id} className="workspace-operational-row" data-state={status}>
                    <div className="workspace-operational-row__top">
                      <div className="workspace-operational-cell"><span className="driver-cell-label">FROM</span><strong>{job.pickup_location ?? job.pickup_postcode ?? 'Collection not supplied'}</strong><div>{job.pickup_postcode ?? 'Postcode not supplied'} · {when(job.pickup_datetime)}</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">TO</span><strong>{job.delivery_location ?? job.delivery_postcode ?? 'Delivery not supplied'}</strong><div>{job.delivery_postcode ?? 'Postcode not supplied'} · {when(job.delivery_datetime)}</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">JOB / DRIVER</span><strong>{(job.vehicle_type ?? 'Vehicle not supplied').replace(/_/g, ' ')}</strong><div>{driver?.display_name ?? driver?.email ?? (job.assigned_driver_id ? 'Assigned driver' : 'Unallocated')} · {job.client_name ?? 'Customer not supplied'}</div></div>
                      <div className="workspace-operational-cell"><span className="driver-cell-label">STATUS</span><StatusBadge value={status || stage} tone={stageTone(job)} /><div style={{ marginTop: 4 }}><ActionButton tone="secondary" onClick={() => toggleJob(job.id)}>{open ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone="secondary" onClick={() => window.location.assign(`/job-replay/${job.id}`)}>Replay</ActionButton></div></div>
                    </div>
                    <div className="workspace-record-meta">
                      <span>Job #{job.id.slice(0, 8).toUpperCase()}</span>
                      {job.booking_reference && <span>Booking: {job.booking_reference}</span>}
                      {job.customer_reference && <span>Customer ref: {job.customer_reference}</span>}
                      {job.pod_generated && <StatusBadge value="POD generated" tone="green" />}
                      {!job.pod_generated && evidenceCount > 0 && <StatusBadge value={`${evidenceCount} evidence file(s)`} tone="blue" />}
                      {!job.assigned_driver_id && (stage === 'awarded' || stage === 'allocated') && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><select value={driverSelections[job.id] ?? ''} onChange={(event) => setDriverSelections((current) => ({ ...current, [job.id]: event.target.value }))} style={{ height: 28, border: '1px solid var(--ws-border)', borderRadius: 4 }}><option value="">Choose active driver</option>{activeAccountDrivers.map((item) => <option key={item.id} value={item.id}>{item.display_name ?? item.email ?? 'Driver'} · {item.availability_status ?? 'availability unknown'}</option>)}</select><ActionButton tone="success" disabled={assigning === job.id} onClick={() => void assignDriver(job)}>{assigning === job.id ? 'Allocating…' : 'Allocate'}</ActionButton></span>}
                    </div>
                    {open && <CompanyJobSheetPanel jobId={job.id} mode="carrier" />}
                  </article>
                );
              })}
            </div>
          )}

          {filtered.length > pageSize && <div className="workspace-record-meta" style={{ justifyContent: 'space-between' }}><span>Page {safePage} / {totalPages}</span><span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><label>Per page <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={{ height: 28 }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><ActionButton tone="secondary" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</ActionButton><ActionButton tone="secondary" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</ActionButton></span></div>}
        </main>
      </div>
    </PageFrame>
  );
}