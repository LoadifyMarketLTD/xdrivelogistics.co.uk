'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { useDriverLocationPublisher } from '../../hooks/useDriverLocationPublisher';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type DriverRow = { id: string; display_name: string | null; availability_status: string | null; status: string | null };
type StatusHistoryEntry = { status: string; timestamp: string };
type JobRow = {
  id: string; status: string; pickup_location: string | null; pickup_postcode: string | null; pickup_datetime: string | null;
  delivery_location: string | null; delivery_postcode: string | null; delivery_datetime: string | null; vehicle_type: string | null;
  cargo_type: string | null; load_details: string | null; assigned_driver_id: string | null; collection_photo_url: string | null;
  delivery_photos: string[] | null; status_history: StatusHistoryEntry[] | null;
};
type JobFilter = 'all' | 'active' | 'allocated' | 'collected' | 'in_transit' | 'delivered';
const ACTIVE_STATUSES = ['allocated', 'collected', 'in_transit'];
const VISIBLE_STATUSES = ['allocated', 'collected', 'in_transit', 'delivered'];
const STATUS_LABELS: Record<string, string> = { allocated: 'Allocated', collected: 'Loaded', in_transit: 'In transit', delivered: 'Delivered', on_my_way_to_pickup: 'On my way to pickup', on_site_pickup: 'On site pickup', on_my_way_to_delivery: 'On my way to delivery', on_site_delivery: 'On site delivery' };
const FILTERS: Array<{ id: JobFilter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'allocated', label: 'Allocated' },
  { id: 'collected', label: 'Loaded' }, { id: 'in_transit', label: 'In transit' }, { id: 'delivered', label: 'Completed' },
];
function fmtTime(value: string | null) { if (!value) return 'TBC'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'TBC' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(value: string | null) { if (!value) return 'TBC'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'TBC' : date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }); }
function hasEvent(job: JobRow | null, event: string) { return Array.isArray(job?.status_history) && job.status_history.some((entry) => entry.status === event); }
function vehicleLabel(job: JobRow) { return job.vehicle_type ? (VEHICLE_TYPE_LABELS[job.vehicle_type] ?? job.vehicle_type.replace(/_/g, ' ')) : 'TBC'; }

export default function DriverJobsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<JobFilter>('all');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!isSupabaseConfigured || !driverId) { setLoading(false); return; }
    setLoading(true); setError('');
    const [driverRes, jobsRes] = await Promise.all([
      supabase.from('drivers').select('id, display_name, availability_status, status').eq('id', driverId).maybeSingle(),
      supabase.from('jobs').select('id, status, pickup_location, pickup_postcode, pickup_datetime, delivery_location, delivery_postcode, delivery_datetime, vehicle_type, cargo_type, load_details, assigned_driver_id, collection_photo_url, delivery_photos, status_history').eq('assigned_driver_id', driverId).in('status', VISIBLE_STATUSES).order('pickup_datetime', { ascending: true }).limit(50),
    ]);
    if (driverRes.error) setError('Your driver status could not be loaded.'); else setDriver(driverRes.data as DriverRow | null);
    if (jobsRes.error) { setError('Assigned jobs could not be loaded. Refresh the page or try again shortly.'); setJobs([]); } else setJobs((jobsRes.data ?? []) as JobRow[]);
    setLoading(false);
  }, [driverId]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);
  const activeJob = useMemo(() => jobs.find((job) => ACTIVE_STATUSES.includes(job.status)) ?? null, [jobs]);
  useDriverLocationPublisher(activeJob?.status, Boolean(activeJob));
  const filteredJobs = useMemo(() => filter === 'all' ? jobs : filter === 'active' ? jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)) : jobs.filter((job) => job.status === filter), [filter, jobs]);

  const updateJob = async (job: JobRow, nextStatus: string, eventOnly = false) => {
    if (!driverId || actionLoading) return;
    setActionLoading(true); setError(''); setMessage('');
    const history = Array.isArray(job.status_history) ? job.status_history : [];
    const status_history = [...history, { status: nextStatus, timestamp: new Date().toISOString() }];
    const { error: updateError } = await supabase.from('jobs').update(eventOnly ? { status_history } : { status: nextStatus, status_history }).eq('id', job.id).eq('assigned_driver_id', driverId);
    if (updateError) setError('That job update could not be saved. Please retry before continuing the journey.');
    else { setMessage(`${STATUS_LABELS[nextStatus] ?? nextStatus} recorded.`); await loadJobs(); window.setTimeout(() => setMessage(''), 3000); }
    setActionLoading(false);
  };

  const driverStatus = driver?.availability_status ?? driver?.status ?? 'active';
  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell driverName={driver?.display_name ?? undefined} availabilityLabel={driverStatus} subtitle="Assigned work, live execution and POD hand-off in one compact board." headerActions={<ActionButton tone="primary" onClick={() => void loadJobs()} disabled={loading}>Refresh</ActionButton>}>
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        {message && <AlertBanner tone="success">{message}</AlertBanner>}
        <div className="driver-board-layout driver-jobs-board">
          <aside className="driver-filter-rail" aria-label="Job status filters">
            <div className="driver-filter-rail__header">My Jobs</div>
            <div className="driver-filter-rail__body">
              {FILTERS.map((item) => {
                const count = item.id === 'all' ? jobs.length : item.id === 'active' ? jobs.filter((job) => ACTIVE_STATUSES.includes(job.status)).length : jobs.filter((job) => job.status === item.id).length;
                return <button key={item.id} type="button" data-active={filter === item.id ? 'true' : 'false'} className="driver-side-tab" onClick={() => setFilter(item.id)}><span>{item.label}</span><strong>{count}</strong></button>;
              })}
              <ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Open Diary</ActionButton>
            </div>
          </aside>
          <main className="driver-board-main">
            <div className="driver-tab-strip" aria-label="Job board views">
              <button type="button" data-active="true">Assigned Work <span>{filteredJobs.length}</span></button>
              <button type="button" onClick={() => router.push('/driver/history')}>Diary</button>
            </div>
            <div className="driver-board-summary"><span>{loading ? 'Loading assigned work…' : `${filteredJobs.length} job${filteredJobs.length === 1 ? '' : 's'} · ${activeJob ? '1 active execution' : 'no active execution'}`}</span><span>Vehicle: {activeJob ? vehicleLabel(activeJob) : 'Not assigned'}</span></div>
            {loading ? <div className="driver-load-row"><EmptyState compact title="Loading jobs…" /></div>
              : filteredJobs.length === 0 ? <div className="driver-load-row"><EmptyState compact title="No jobs in this status" /></div>
              : <div className="driver-load-list">{filteredJobs.map((job) => {
                const expanded = expandedJobId === job.id;
                const hasPod = Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0;
                const isActive = ACTIVE_STATUSES.includes(job.status);
                const routeEvent = job.status === 'in_transit' ? 'on_my_way_to_delivery' : 'on_my_way_to_pickup';
                const arrivalEvent = job.status === 'in_transit' ? 'on_site_delivery' : 'on_site_pickup';
                return <article key={job.id} className="driver-load-row" data-state={job.status}>
                  <div className="driver-load-row__top">
                    <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{job.pickup_location ?? 'Collection'}</strong><span className="driver-cell-secondary">{job.pickup_postcode ?? 'Postcode TBC'} · {fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</span></div>
                    <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{job.delivery_location ?? 'Delivery'}</strong><span className="driver-cell-secondary">{job.delivery_postcode ?? 'Postcode TBC'} · {fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</span></div>
                    <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicleLabel(job)}</strong><span className="driver-cell-secondary">{job.cargo_type?.replace(/_/g, ' ') ?? 'Cargo not specified'}</span></div>
                    <div className="driver-load-cell"><span className="driver-cell-label">Status</span><strong className="driver-cell-primary">{STATUS_LABELS[job.status] ?? job.status}</strong><span className="driver-cell-secondary">{hasPod ? 'POD captured' : isActive ? 'Execution in progress' : 'Job record'}</span></div>
                  </div>
                  <div className="driver-load-row__meta">
                    <span>Job #{job.id.slice(0, 8).toUpperCase()}</span>
                    <StatusBadge value={STATUS_LABELS[job.status] ?? job.status} tone={job.status === 'delivered' ? 'green' : isActive ? 'orange' : 'neutral'} />
                    {hasPod && <StatusBadge value="POD captured" tone="green" />}
                    <div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => setExpandedJobId(expanded ? null : job.id)}>{expanded ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone="secondary" onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open job</ActionButton></div>
                  </div>
                  {expanded && <div className="driver-row-details">
                    <div className="driver-detail-grid">
                      <div className="driver-detail-item"><span>Pickup</span><strong>{fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</strong></div>
                      <div className="driver-detail-item"><span>Delivery</span><strong>{fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</strong></div>
                      <div className="driver-detail-item"><span>Vehicle</span><strong>{vehicleLabel(job)}</strong></div>
                      <div className="driver-detail-item"><span>POD</span><strong>{hasPod ? 'Captured' : 'Pending'}</strong></div>
                    </div>
                    {isActive && <div className="driver-inline-quote driver-job-actions">
                      <ActionButton tone="primary" disabled={actionLoading || hasEvent(job, routeEvent)} onClick={() => void updateJob(job, routeEvent, true)}>{job.status === 'in_transit' ? 'On way to delivery' : 'On way to pickup'}</ActionButton>
                      <ActionButton tone="secondary" disabled={actionLoading || hasEvent(job, arrivalEvent)} onClick={() => void updateJob(job, arrivalEvent, true)}>{job.status === 'in_transit' ? 'On site delivery' : 'On site pickup'}</ActionButton>
                      <ActionButton tone="success" disabled={actionLoading || job.status !== 'allocated'} onClick={() => void updateJob(job, 'collected')}>Loaded</ActionButton>
                      <ActionButton tone="warning" disabled={actionLoading} onClick={() => router.push(`/driver/jobs/${job.id}`)}>Delivered / POD</ActionButton>
                    </div>}
                  </div>}
                </article>;
              })}</div>}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
