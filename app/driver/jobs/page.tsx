'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { canonicalExecutionStatus, matchesDriverJobView, type DriverJobView } from '../../../lib/jobs/jobLifecyclePresentation';
import { classifyWorkspaceJobStage } from '../../../lib/jobs/workspaceJobStage';
import { useDriverLocationPublisher } from '../../hooks/useDriverLocationPublisher';
import { OperationalExpandAllControl } from '../../components/workspace/OperationalExpandAllControl';
import { ActionButton, AlertBanner, EmptyState, StatusBadge } from '../../components/workspace/WorkspaceUI';

type DriverRow = {
  id: string;
  display_name: string | null;
  availability_status: string | null;
  status: string | null;
};

type JobRow = {
  id: string;
  status: string;
  current_status: string | null;
  pickup_location: string | null;
  pickup_postcode: string | null;
  pickup_datetime: string | null;
  delivery_location: string | null;
  delivery_postcode: string | null;
  delivery_datetime: string | null;
  vehicle_type: string | null;
  vehicle_id?: string | null;
  cargo_type: string | null;
  load_details: string | null;
  assigned_driver_id: string | null;
  awarded_carrier_company_id?: string | null;
  collection_photo_url: string | null;
  delivery_photos: string[] | null;
};

const JOB_COLUMNS = [
  'id',
  'status',
  'current_status',
  'pickup_location',
  'pickup_postcode',
  'pickup_datetime',
  'delivery_location',
  'delivery_postcode',
  'delivery_datetime',
  'vehicle_type',
  'vehicle_id',
  'cargo_type',
  'load_details',
  'assigned_driver_id',
  'awarded_carrier_company_id',
  'collection_photo_url',
  'delivery_photos',
];
const LEGACY_JOB_COLUMNS = JOB_COLUMNS.filter((column) => column !== 'vehicle_id');

const STATUS_LABELS: Record<string, string> = {
  awarded: 'Awarded', allocated: 'Allocated', accepted: 'Accepted',
  on_my_way: 'On my way to pickup', on_my_way_to_pickup: 'On my way to pickup', on_site_pickup: 'On site pickup',
  loaded: 'Loaded', collected: 'Loaded', in_transit: 'In transit', on_my_way_to_delivery: 'On my way to delivery',
  on_site_delivery: 'On site delivery', delivered: 'Delivered', completed: 'Completed', invoiced: 'Invoiced', paid: 'Paid',
};

const FILTERS: Array<{ id: DriverJobView; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'allocated', label: 'Allocated' },
  { id: 'loaded', label: 'Loaded' }, { id: 'in_transit', label: 'In Transit' }, { id: 'completed', label: 'Completed' },
];

function effectiveStatus(job: JobRow) {
  return canonicalExecutionStatus(job.current_status || job.status);
}
function driverJobStage(job: JobRow) {
  return classifyWorkspaceJobStage(job);
}
function matchesFilter(job: JobRow, filter: DriverJobView) {
  return matchesDriverJobView(job.current_status || job.status, filter);
}
function fmtTime(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'TBC' : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(value: string | null) {
  if (!value) return 'TBC';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'TBC' : date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}
function vehicleLabel(job: JobRow) {
  return job.vehicle_type ? (VEHICLE_TYPE_LABELS[job.vehicle_type] ?? job.vehicle_type.replace(/_/g, ' ')) : 'TBC';
}
function stageTone(job: JobRow): 'green' | 'blue' | 'orange' | 'red' | 'grey' {
  const stage = driverJobStage(job);
  if (stage === 'completed') return 'green';
  if (stage === 'cancelled' || stage === 'disputed') return 'red';
  if (stage === 'in_progress') return 'orange';
  if (stage === 'allocated' || stage === 'awarded') return 'blue';
  return 'grey';
}

export default function DriverJobsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<DriverJobView>('all');
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(() => new Set());

  const loadJobs = useCallback(async () => {
    if (!isSupabaseConfigured || !driverId) { setJobs([]); setLoading(false); return; }
    setLoading(true); setError('');

    const loadAssignedJobs = async (columns: readonly string[]) => supabase.from('jobs')
      .select(columns.join(', '))
      .eq('assigned_driver_id', driverId)
      .order('pickup_datetime', { ascending: true })
      .limit(75);

    const driverPromise = supabase.from('drivers')
      .select('id, display_name, availability_status, status')
      .eq('id', driverId)
      .maybeSingle();
    const firstJobsResult = await loadAssignedJobs(JOB_COLUMNS);
    const jobsResult = firstJobsResult.error && isMissingColumnError(firstJobsResult.error, 'jobs', 'vehicle_id')
      ? await loadAssignedJobs(LEGACY_JOB_COLUMNS)
      : firstJobsResult;
    const driverRes = await driverPromise;

    if (driverRes.error) setError('Your driver status could not be loaded.');
    else setDriver(driverRes.data as DriverRow | null);
    if (jobsResult.error) { setError('Assigned jobs could not be loaded. Refresh the page or try again shortly.'); setJobs([]); }
    else setJobs((jobsResult.data ?? []) as unknown as JobRow[]);
    setLoading(false);
  }, [driverId]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  const activeJob = useMemo(
    () => jobs.find((job) => driverJobStage(job) === 'in_progress') ?? null,
    [jobs],
  );
  useDriverLocationPublisher(activeJob ? effectiveStatus(activeJob) : undefined, Boolean(activeJob));

  const filteredJobs = useMemo(() => jobs.filter((job) => matchesFilter(job, filter)), [filter, jobs]);
  const countFor = (target: DriverJobView) => jobs.filter((job) => matchesFilter(job, target)).length;
  const driverStatus = driver?.availability_status ?? driver?.status ?? 'active';
  const allVisibleExpanded = filteredJobs.length > 0 && filteredJobs.every((job) => expandedJobIds.has(job.id));

  const toggleExpandAll = () => {
    const expanding = !allVisibleExpanded;
    setExpandedJobIds((current) => {
      const next = new Set(current);
      for (const job of filteredJobs) {
        if (expanding) next.add(job.id);
        else next.delete(job.id);
      }
      return next;
    });
  };

  const toggleJob = (jobId: string) => {
    setExpandedJobIds((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  return (
    <ProtectedRoute allowedRoles={['driver']}>
      <DriverWorkspaceShell
        driverName={driver?.display_name ?? undefined}
        availabilityLabel={driverStatus}
        subtitle="Assigned work, live execution and POD hand-off in one compact board."
        headerActions={<ActionButton tone="primary" onClick={() => void loadJobs()} disabled={loading}>Refresh</ActionButton>}
      >
        {error && <AlertBanner tone="danger">{error}</AlertBanner>}
        <div className="driver-board-layout driver-jobs-board">
          <aside className="driver-filter-rail" aria-label="Job board context">
            <div className="driver-filter-rail__header">Execution Context</div>
            <div className="driver-filter-rail__body">
              <div className="driver-detail-item"><span>Current execution</span><strong>{activeJob ? `${activeJob.pickup_postcode ?? activeJob.pickup_location ?? 'Collection'} → ${activeJob.delivery_postcode ?? activeJob.delivery_location ?? 'Delivery'}` : 'No active job'}</strong></div>
              <div className="driver-detail-item"><span>Assigned work</span><strong>{jobs.length}</strong></div>
              <div className="driver-detail-item"><span>Driver status</span><strong>{driverStatus.replace(/_/g, ' ')}</strong></div>
              <ActionButton tone="secondary" onClick={() => router.push('/driver/history')}>Open Diary</ActionButton>
            </div>
          </aside>

          <main className="driver-board-main">
            <div className="driver-tab-strip" role="tablist" aria-label="Job status views">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  data-active={filter === item.id ? 'true' : 'false'}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} <span>{countFor(item.id)}</span>
                </button>
              ))}
            </div>
            <div className="driver-board-summary">
              <span>{loading ? 'Loading assigned work…' : `${filteredJobs.length} job${filteredJobs.length === 1 ? '' : 's'} · ${activeJob ? '1 active execution' : 'no active execution'}`}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span>Vehicle: {activeJob ? vehicleLabel(activeJob) : 'No job currently in execution'}</span>
                <OperationalExpandAllControl expanded={allVisibleExpanded} disabled={!filteredJobs.length} onToggle={toggleExpandAll} noun="jobs" />
              </span>
            </div>

            {loading ? <div className="driver-load-row"><EmptyState compact title="Loading jobs…" /></div>
              : filteredJobs.length === 0 ? <div className="driver-load-row"><EmptyState compact title="No jobs in this status" /></div>
              : <div className="driver-load-list">{filteredJobs.map((job) => {
                  const expanded = expandedJobIds.has(job.id);
                  const status = effectiveStatus(job);
                  const stage = driverJobStage(job);
                  const hasPod = Array.isArray(job.delivery_photos) && job.delivery_photos.length > 0;
                  const inExecution = stage === 'in_progress';
                  const complete = stage === 'completed';
                  return <article key={job.id} className="driver-load-row" data-state={status}>
                    <div className="driver-load-row__top">
                      <div className="driver-load-cell"><span className="driver-cell-label">From</span><strong className="driver-cell-primary">{job.pickup_location ?? 'Collection'}</strong><span className="driver-cell-secondary">{job.pickup_postcode ?? 'Postcode TBC'} · {fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">To</span><strong className="driver-cell-primary">{job.delivery_location ?? 'Delivery'}</strong><span className="driver-cell-secondary">{job.delivery_postcode ?? 'Postcode TBC'} · {fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Vehicle</span><strong className="driver-cell-primary">{vehicleLabel(job)}</strong><span className="driver-cell-secondary">{job.cargo_type?.replace(/_/g, ' ') ?? 'Cargo not specified'}</span></div>
                      <div className="driver-load-cell"><span className="driver-cell-label">Status</span><strong className="driver-cell-primary">{STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}</strong><span className="driver-cell-secondary">{hasPod ? 'Delivery photo evidence captured' : inExecution ? 'Execution in progress' : complete ? 'Execution complete' : stage === 'allocated' || stage === 'awarded' ? 'Assigned / awaiting execution' : 'Job record'}</span></div>
                    </div>
                    <div className="driver-load-row__meta"><span>Job #{job.id.slice(0, 8).toUpperCase()}</span><StatusBadge value={STATUS_LABELS[status] ?? status} tone={stageTone(job)} />{hasPod && <StatusBadge value="Delivery evidence" tone="green" />}<div className="driver-row-actions"><ActionButton tone="secondary" onClick={() => toggleJob(job.id)}>{expanded ? 'Collapse' : 'Details'}</ActionButton><ActionButton tone={inExecution ? 'success' : 'secondary'} onClick={() => router.push(`/driver/jobs/${job.id}`)}>{inExecution ? 'Continue job' : 'Open job'}</ActionButton></div></div>
                    {expanded && <div className="driver-row-details"><div className="driver-detail-grid"><div className="driver-detail-item"><span>Pickup</span><strong>{fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</strong></div><div className="driver-detail-item"><span>Delivery</span><strong>{fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</strong></div><div className="driver-detail-item"><span>Vehicle</span><strong>{vehicleLabel(job)}</strong></div><div className="driver-detail-item"><span>Evidence</span><strong>{hasPod ? 'Delivery photos captured' : complete ? 'Open job / Diary for full POD state' : 'Pending execution'}</strong></div></div><div className="driver-inline-quote driver-job-actions"><span style={{ color: '#64748b', fontSize: '11px', lineHeight: '15px', flex: '1 1 260px' }}>Journey status, loading evidence and POD are updated only from the full execution screen so every transition follows the canonical driver state machine.</span><ActionButton tone={inExecution ? 'success' : 'secondary'} onClick={() => router.push(`/driver/jobs/${job.id}`)}>{inExecution ? 'Continue execution' : 'Open details'}</ActionButton></div></div>}
                  </article>;
                })}</div>}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
