'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import DriverWorkspaceShell from '../_components/DriverWorkspaceShell';
import CxDiaryCard from '../../components/workspace/CxDiaryCard';
import { useAuth } from '../../components/AuthContext';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';
import { isMissingColumnError } from '../../../lib/supabaseSchemaCompat';
import { VEHICLE_TYPE_LABELS } from '../../../lib/vehicleTypes';
import { canonicalExecutionStatus, matchesDriverJobView, type DriverJobView } from '../../../lib/jobs/jobLifecyclePresentation';
import { classifyWorkspaceJobStage, workspaceJobOperationalLabel } from '../../../lib/jobs/workspaceJobStage';
import {hasCompletePodEvidence,isDeliveredAwaitingPod} from '../../../lib/jobs/podCompletion';
import { useDriverLocationPublisher } from '../../hooks/useDriverLocationPublisher';
import { OperationalExpandAllControl } from '../../components/workspace/OperationalExpandAllControl';
import { ActionButton, AlertBanner, EmptyState } from '../../components/workspace/WorkspaceUI';

type DriverBookingView = DriverJobView | 'current';

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
  pod_generated: boolean | null;
  pod_photos: string[] | null;
  delivery_signature_data: unknown;
  client_signature_name: string | null;
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
  'pod_generated',
  'pod_photos',
  'delivery_signature_data',
  'client_signature_name',
];
const LEGACY_JOB_COLUMNS = JOB_COLUMNS.filter((column) => column !== 'vehicle_id');

const FILTERS: Array<{ id: DriverBookingView; label: string }> = [
  { id: 'current', label: 'Current' }, { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'allocated', label: 'Allocated' },
  { id: 'loaded', label: 'Loaded' }, { id: 'in_transit', label: 'In Transit' }, { id: 'completed', label: 'Completed' },
];

function effectiveStatus(job: JobRow) {
  return canonicalExecutionStatus(job.current_status || job.status);
}
function driverJobStage(job: JobRow) {
  return classifyWorkspaceJobStage(job);
}
function matchesFilter(job: JobRow, filter: DriverBookingView) {
  if (filter === 'current') return ['allocated', 'awarded', 'in_progress'].includes(driverJobStage(job)) || isDeliveredAwaitingPod(job);
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

export default function DriverJobsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const driverId = typeof user?.driverId === 'string' ? user.driverId.trim() : '';
  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<DriverBookingView>('current');
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
  useDriverLocationPublisher(activeJob ? effectiveStatus(activeJob) : undefined, Boolean(activeJob), activeJob?.id);

  const filteredJobs = useMemo(() => jobs.filter((job) => matchesFilter(job, filter)).sort((a,b)=>{
    const priority=(job:JobRow)=>driverJobStage(job)==='in_progress'?0:isDeliveredAwaitingPod(job)?1:['allocated','awarded'].includes(driverJobStage(job))?2:driverJobStage(job)==='completed'?3:4;
    const difference=priority(a)-priority(b);
    return difference || String(a.pickup_datetime??'').localeCompare(String(b.pickup_datetime??''));
  }), [filter, jobs]);
  const countFor = (target: DriverBookingView) => jobs.filter((job) => matchesFilter(job, target)).length;
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
      <DriverWorkspaceShell hideHeader
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
            <header className="xd-approved-board-header"><div><h1 className="xd-approved-board-title">Bookings</h1><p className="xd-approved-board-subtitle">Assigned work, execution and proof of delivery</p></div></header>
            <div className="xd-approved-board-kpis" aria-label="Real booking statistics">
              <div className="xd-approved-board-kpi"><strong>Total Bookings</strong><b>{jobs.length}</b><small>Assigned to this Driver</small></div>
              <div className="xd-approved-board-kpi blue"><strong>Current</strong><b>{jobs.filter(job => matchesFilter(job, 'current')).length}</b><small>Active or upcoming</small></div>
              <div className="xd-approved-board-kpi green"><strong>Completed</strong><b>{jobs.filter(job => driverJobStage(job) === 'completed').length}</b><small>Completed records</small></div>
              <div className="xd-approved-board-kpi amber"><strong>Awaiting POD</strong><b>{jobs.filter(isDeliveredAwaitingPod).length}</b><small>Delivery evidence required</small></div>
              <div className="xd-approved-board-kpi blue"><strong>Shown</strong><b>{filteredJobs.length}</b><small>Matching current status</small></div>
            </div>
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
                  const hasPod = hasCompletePodEvidence(job);
                  const inExecution = stage === 'in_progress';
                  const complete = stage === 'completed';
                  return <CxDiaryCard
                    key={job.id}
                    className="xd-approved-bookings-card"
                    from={job.pickup_location ?? job.pickup_postcode ?? 'Collection'}
                    to={job.delivery_location ?? job.delivery_postcode ?? 'Delivery'}
                    pickup={{ primary: fmtTime(job.pickup_datetime), meta: [job.pickup_datetime?.slice(0,10), job.pickup_postcode].filter(Boolean).join(' | ') }}
                    delivery={{ primary: fmtTime(job.delivery_datetime), meta: [job.delivery_datetime?.slice(0,10), job.delivery_postcode].filter(Boolean).join(' | ') }}
                    band={workspaceJobOperationalLabel(job)}
                    loadId={job.id.slice(0, 8).toUpperCase()}
                    vehicle={vehicleLabel(job)}
                    statusLine={stage === 'cancelled' ? 'Cancelled booking' : stage === 'completed' ? (hasPod ? 'POD complete' : 'POD action required') : 'Assigned to you'}
                    expandedMeta={<><span>{job.cargo_type?.replace(/_/g, ' ') ?? 'Cargo not specified'}</span><span>{hasPod ? 'Delivery evidence captured' : inExecution ? 'Execution in progress' : 'Awaiting execution'}</span></>}
                    state={status}
                    expanded={expanded}
                    footer={<>
                      <button type="button" className="xd-approved-view-details" onClick={() => toggleJob(job.id)}>{expanded ? 'Hide Details' : 'View Details'}</button>
                      <ActionButton tone={inExecution ? 'success' : 'secondary'} onClick={() => router.push(`/driver/jobs/${job.id}`)}>{inExecution ? 'Continue job' : 'Open Booking'}</ActionButton>
                    </>}
                    expandedContent={<div className="driver-row-details">
                      <div className="driver-detail-grid">
                        <div className="driver-detail-item"><span>Pickup</span><strong>{fmtDate(job.pickup_datetime)} {fmtTime(job.pickup_datetime)}</strong></div>
                        <div className="driver-detail-item"><span>Delivery</span><strong>{fmtDate(job.delivery_datetime)} {fmtTime(job.delivery_datetime)}</strong></div>
                        <div className="driver-detail-item"><span>Vehicle</span><strong>{vehicleLabel(job)}</strong></div>
                        <div className="driver-detail-item"><span>Evidence</span><strong>{hasPod ? 'POD complete' : isDeliveredAwaitingPod(job) ? 'POD action required' : complete ? 'Open booking for full POD state' : 'Pending execution'}</strong></div>
                      </div>
                      <div className="driver-inline-quote driver-job-actions">
                        <span>Journey status and POD are updated only through the authorised execution workflow.</span>
                        <ActionButton tone={inExecution ? 'success' : 'secondary'} onClick={() => router.push(`/driver/jobs/${job.id}`)}>Open Booking Details</ActionButton>
                      </div>
                    </div>}
                  />;
                })}</div>}
          </main>
        </div>
      </DriverWorkspaceShell>
    </ProtectedRoute>
  );
}
